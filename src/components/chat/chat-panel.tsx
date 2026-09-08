"use client";

/**
 * /chat page body. Owns channel selection, the 5 s message poll of the open thread,
 * read markers and sending; channels + the feature flag come from ChatContext (shared
 * with the shell badges). Desktop: channel list left, thread right. Narrow widths:
 * channel chips above the thread, like the phone app.
 *
 * Default channel: `initialChannelKey` (deep link), else the selected project's channel,
 * else the first channel (company channels come first from the backend).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import {
  ChatApiError,
  listChatMessages,
  markChatChannelRead,
  sendChatMessage,
  type ChatMessagePage,
} from "@/lib/api/chat-client";
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

export function ChatPanel({ initialChannelKey }: { initialChannelKey?: string | null }) {
  const t = useTranslations("chat");
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { enabled, channels, channelsLoaded, refreshChannels } = useChat();

  const [selected, setSelected] = useState<string | null>(initialChannelKey ?? null);
  const channelKey = useMemo(() => {
    const has = (key: string | null) => Boolean(key) && channels.some((c) => c.key === key);
    if (has(selected)) return selected;
    const projectKey = selectedProjectId ? `project:${selectedProjectId}` : null;
    if (has(projectKey)) return projectKey;
    return channels[0]?.key ?? null;
  }, [channels, selected, selectedProjectId]);
  const channel = channels.find((c) => c.key === channelKey) ?? null;

  const [page, setPage] = useState<ChatMessagePage | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
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

  const markRead = useCallback(
    async (key: string) => {
      try {
        await markChatChannelRead(key);
        await refreshChannels();
      } catch {
        // Read markers are best effort; the next open retries.
      }
    },
    [refreshChannels]
  );

  // Opening (or switching to) a channel clears its unread marker.
  useEffect(() => {
    if (active && channelKey) void markRead(channelKey);
  }, [active, channelKey, markRead]);

  const items = page?.items ?? [];
  const members = page?.members ?? [];
  const lastMessage = items[items.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageMine = lastMessage?.mine ?? true;

  // Keep the thread anchored to the newest message; an incoming one is read since the
  // thread is open, so move the marker too (that shows this reader's avatar to the sender).
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    if (lastMessageId && !lastMessageMine && channelKey) void markRead(channelKey);
  }, [lastMessageId, lastMessageMine, channelKey, markRead]);

  const seen = useMemo(
    () => seenByMessage(page?.items ?? [], page?.members ?? [], user?.id),
    [page, user?.id]
  );

  const handleSend = useCallback(
    async (input: { body: string; file: File | null }): Promise<boolean> => {
      if (!channelKey) return false;
      setSending(true);
      try {
        await sendChatMessage(channelKey, input);
        await Promise.all([refreshMessages(), refreshChannels()]);
        return true;
      } catch (error) {
        toast.error(t(sendErrorKey(error)));
        return false;
      } finally {
        setSending(false);
      }
    },
    [channelKey, refreshMessages, refreshChannels, t]
  );

  const handleReject = useCallback(
    (reason: ComposerRejection) => toast.error(t(`errors.${reason}`)),
    [t]
  );

  // ---- Empty / loading states ----
  if (enabled === false) {
    return <PanelNotice testId="chat-disabled">{t("disabled")}</PanelNotice>;
  }
  if (enabled === null || (!channelsLoaded && channels.length === 0)) {
    return (
      <PanelNotice testId="chat-loading">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      </PanelNotice>
    );
  }
  if (channels.length === 0) {
    return <PanelNotice testId="chat-no-channels">{t("noChannels")}</PanelNotice>;
  }

  return (
    <div className="flex h-full min-h-0" data-testid="chat-panel">
      <aside
        className="hidden w-[260px] flex-shrink-0 flex-col overflow-y-auto border-r p-3 lg:flex"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="label-cap px-3 pb-2 pt-1">{t("channels")}</div>
        <ChatChannelList channels={channels} selectedKey={channelKey} onSelect={setSelected} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <ChatThreadHeader channel={channel} members={members} />
        <div className="border-b lg:hidden" style={{ borderColor: "var(--line)" }}>
          <ChatChannelChips channels={channels} selectedKey={channelKey} onSelect={setSelected} />
        </div>

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
            {items.length > 0 ? <ChatMessageList messages={items} seen={seen} /> : null}
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

function PanelNotice({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      className="flex h-full items-center justify-center p-8 text-center text-[13px]"
      style={{ color: "var(--muted)" }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
