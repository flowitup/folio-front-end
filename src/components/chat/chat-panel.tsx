"use client";

/**
 * Chat drawer body. Owns channel selection, the 5 s message poll of the open thread,
 * read markers and sending; channels + the feature flag come from ChatContext (shared
 * with the floating button). `layout="split"`: channel list left, thread right (expanded
 * drawer). `layout="stack"`: channel chips above the thread, like the phone app.
 *
 * Default channel: `initialChannelKey` (deep link), else the selected project's channel,
 * else the first channel (company channels come first from the backend).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import { useAssistantFeature } from "@/hooks/use-chat-feature";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import {
  ChatApiError,
  listChatMessages,
  markChatChannelRead,
  sendChatMessage,
  submitAssistantAction,
  type ChatMessage,
  type ChatMessagePage,
} from "@/lib/api/chat-client";
import type { AssistantChoiceOption } from "@/lib/chat/assistant-choice";
import { seenByMessage } from "@/lib/chat/seen-by";
import { ChatChannelChips, ChatChannelList } from "@/components/chat/chat-channel-list";
import { ChatComposer, type ComposerRejection } from "@/components/chat/chat-composer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatThreadHeader } from "@/components/chat/chat-thread-header";

export const CHAT_MESSAGES_POLL_MS = 5_000;

function sendErrorKey(error: unknown): string {
  if (error instanceof ChatApiError) {
    if (error.status === 413) return "errors.tooLarge";
    if (error.status === 415) return "errors.unsupportedType";
    if (error.status === 403) return "errors.forbidden";
  }
  return "errors.sendFailed";
}

/** Distinct copy per status the backend answers `POST /assistant/actions` with; anything
 * else (network error, 404 `FeatureDisabled`, 422, 500) falls back to a generic failure. */
function assistantActionErrorKey(error: unknown): string {
  if (error instanceof ChatApiError) {
    if (error.status === 403) return "assistant.actionNotAddressed";
    if (error.status === 409) return "assistant.actionAlreadyAnswered";
    if (error.status === 503) return "assistant.actionQueueUnavailable";
  }
  return "assistant.actionFailed";
}

export type ChatPanelLayout = "split" | "stack";

export function ChatPanel({
  initialChannelKey,
  layout = "stack",
}: {
  initialChannelKey?: string | null;
  layout?: ChatPanelLayout;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { enabled, channels, channelsLoaded, channelsError, refreshChannels } = useChat();
  const assistantEnabled = useAssistantFeature();

  const [selected, setSelected] = useState<string | null>(initialChannelKey ?? null);
  const channelKey = useMemo(() => {
    const has = (key: string | null) => Boolean(key) && channels.some((c) => c.key === key);
    if (has(selected)) return selected;
    const projectKey = selectedProjectId ? `project:${selectedProjectId}` : null;
    if (has(projectKey)) return projectKey;
    return channels[0]?.key ?? null;
  }, [channels, selected, selectedProjectId]);
  const channel = channels.find((c) => c.key === channelKey) ?? null;
  // Latch the resolved default so a re-ordered channel poll can never move the open thread
  // (and mark a channel read) without a click.
  useEffect(() => {
    if (!selected && channelKey) setSelected(channelKey);
  }, [selected, channelKey]);

  const [page, setPage] = useState<ChatMessagePage | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  // Guards a double click synchronously: two clicks fired in the same tick both see the
  // state above still unset (React batches the setState below), so only a plain mutable
  // ref catches the second one before it ever calls the endpoint.
  const pendingActionRef = useRef<string | null>(null);
  // Channel shown right now, read after an await to tell whether the user switched away.
  const channelKeyRef = useRef(channelKey);
  channelKeyRef.current = channelKey;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Nothing polls unless the backend confirmed the feature, even if stale channels linger.
  const active = enabled === true && Boolean(channelKey);
  const { refresh: refreshMessages } = useVisiblePoll<ChatMessagePage>({
    enabled: active,
    resetKey: channelKey,
    intervalMs: CHAT_MESSAGES_POLL_MS,
    fetcher: (signal) => listChatMessages(channelKey ?? "", {}, signal),
    onUpdate: useCallback((next: ChatMessagePage) => {
      setPage(next);
      setLoadFailed(false);
    }, []),
    onError: useCallback(() => setLoadFailed(true), []),
  });

  // Switching channels: drop the previous thread so the old messages never flash under
  // the new header while the first fetch is in flight.
  useEffect(() => {
    setPage(null);
    setLoadFailed(false);
  }, [channelKey]);

  // Newest instant already covered by a read marker per channel, so an open + the first page
  // (or a burst of incoming messages) produce one POST /read instead of one per message.
  const markedRef = useRef<{ key: string; upTo: number } | null>(null);
  const markRead = useCallback(
    async (key: string, upTo: number) => {
      const marked = markedRef.current;
      if (marked && marked.key === key && marked.upTo >= upTo) return;
      markedRef.current = { key, upTo };
      try {
        await markChatChannelRead(key);
        await refreshChannels();
      } catch {
        // Read markers are best effort; the next message or open retries.
        if (markedRef.current?.key === key) markedRef.current = null;
      }
    },
    [refreshChannels]
  );

  // Opening (or switching to) a channel clears its unread marker up to now.
  useEffect(() => {
    if (active && channelKey) void markRead(channelKey, Date.now());
  }, [active, channelKey, markRead]);

  const items = page?.items ?? [];
  const members = page?.members ?? [];
  const lastMessage = items[items.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageMine = lastMessage?.mine ?? true;
  const lastMessageAt = lastMessage ? Date.parse(lastMessage.created_at) : 0;

  // Keep the thread anchored to the newest message; an incoming one is read since the
  // thread is open, so move the marker too (that shows this reader's avatar to the sender).
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    if (lastMessageId && !lastMessageMine && channelKey) void markRead(channelKey, lastMessageAt);
  }, [lastMessageId, lastMessageMine, lastMessageAt, channelKey, markRead]);

  const seen = useMemo(
    () => seenByMessage(page?.items ?? [], page?.members ?? [], user?.id),
    [page, user?.id]
  );

  const handleSend = useCallback(
    async (input: { body: string; file: File | null }): Promise<boolean> => {
      if (!channelKey) return false;
      setSending(true);
      try {
        // Sent on every message, not just when the assistant is addressed: the
        // backend only knows to prefer it over its own body-text language sniff.
        await sendChatMessage(channelKey, { ...input, lang: locale });
        await Promise.all([refreshMessages(), refreshChannels()]);
        return true;
      } catch (error) {
        toast.error(t(sendErrorKey(error)));
        return false;
      } finally {
        setSending(false);
      }
    },
    [channelKey, locale, refreshMessages, refreshChannels, t]
  );

  const handleReject = useCallback(
    (reason: ComposerRejection) => toast.error(t(`errors.${reason}`)),
    [t]
  );

  // Tapping a choice option: optimistic "answered" on the message, then the real request.
  // A 409 (already answered) and a 503 (could not enqueue — the server already reset the
  // choice to unanswered on its side) both need the same recovery as any other failure: the
  // optimistic snapshot is discarded and the thread refetched, so the server's own state
  // wins over the local guess either way.
  const handleSelectChoiceOption = useCallback(
    async (message: ChatMessage, option: AssistantChoiceOption) => {
      if (!channelKey || pendingActionRef.current) return;
      const tappedChannelKey = channelKey;
      pendingActionRef.current = message.id;
      setPendingMessageId(message.id);
      let previous: ChatMessagePage | null = null;
      setPage((current) => {
        previous = current;
        return (
          current && {
            ...current,
            items: current.items.map((item) =>
              item.id === message.id
                ? {
                    ...item,
                    payload: {
                      ...(item.payload ?? {}),
                      answered: option.action,
                      answered_payload: option.payload,
                    },
                  }
                : item
            ),
          }
        );
      });
      try {
        await submitAssistantAction({
          action: option.action,
          payload: option.payload,
          reply_to_id: message.id,
        });
        await refreshMessages();
      } catch (error) {
        // Restoring the snapshot after a channel switch would show the old thread's messages.
        if (channelKeyRef.current === tappedChannelKey) setPage(previous);
        await refreshMessages();
        toast.error(t(assistantActionErrorKey(error)));
      } finally {
        pendingActionRef.current = null;
        setPendingMessageId(null);
      }
    },
    [channelKey, refreshMessages, t]
  );

  // ---- Empty / loading states ----
  if (enabled === false) {
    return <PanelNotice testId="chat-disabled">{t("disabled")}</PanelNotice>;
  }
  if (channelsError && channels.length === 0) {
    return (
      <PanelNotice testId="chat-channels-error">
        <div className="flex flex-col items-center gap-2">
          <span>{t("loadError")}</span>
          <button type="button" className="btn btn-quiet" onClick={() => void refreshChannels()}>
            {t("retry")}
          </button>
        </div>
      </PanelNotice>
    );
  }
  if (enabled === null || (!channelsLoaded && channels.length === 0)) {
    return (
      <PanelNotice testId="chat-loading" aria-busy="true">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      </PanelNotice>
    );
  }
  if (channels.length === 0) {
    return <PanelNotice testId="chat-no-channels">{t("noChannels")}</PanelNotice>;
  }

  return (
    <div className="flex h-full min-h-0" data-testid="chat-panel">
      {layout === "split" ? (
        <aside
          className="flex w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r p-3"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="label-cap px-3 pb-2 pt-1">{t("channels")}</div>
          <ChatChannelList channels={channels} selectedKey={channelKey} onSelect={setSelected} />
        </aside>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <ChatThreadHeader channel={channel} members={members} />
        {layout === "stack" ? (
          <div className="border-b" style={{ borderColor: "var(--line)" }}>
            <ChatChannelChips channels={channels} selectedKey={channelKey} onSelect={setSelected} />
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="chat-scroll">
          <div className="flex min-h-full flex-col justify-end p-4">
            {!page && !loadFailed ? (
              <div className="my-6 flex justify-center" style={{ color: "var(--muted)" }}>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              </div>
            ) : null}
            {loadFailed && !page ? (
              <div className="my-6 flex flex-col items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
                <span>{t("loadError")}</span>
                <button type="button" className="btn btn-quiet" onClick={() => void refreshMessages()}>
                  {t("retry")}
                </button>
              </div>
            ) : null}
            {page && items.length === 0 ? (
              <div className="my-6 text-center text-[13px]" style={{ color: "var(--muted)" }} data-testid="chat-empty">
                {t("empty")}
              </div>
            ) : null}
            {items.length > 0 ? (
              <ChatMessageList
                messages={items}
                seen={seen}
                currentUserId={user?.id}
                assistantEnabled={assistantEnabled === true}
                pendingMessageId={pendingMessageId}
                onSelectChoiceOption={handleSelectChoiceOption}
              />
            ) : null}
          </div>
        </div>

        <ChatComposer
          disabled={!channelKey}
          sending={sending}
          onSend={handleSend}
          onReject={handleReject}
        />
      </section>
    </div>
  );
}

function PanelNotice({
  children,
  testId,
  ...rest
}: {
  children: React.ReactNode;
  testId: string;
  "aria-busy"?: React.AriaAttributes["aria-busy"];
}) {
  return (
    <div
      className="flex h-full items-center justify-center p-8 text-center text-[13px]"
      style={{ color: "var(--muted)" }}
      data-testid={testId}
      {...rest}
    >
      {children}
    </div>
  );
}
