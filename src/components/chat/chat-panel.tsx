"use client";

/**
 * Chat drawer body. Owns channel selection, the 5 s message poll of the open thread,
 * read markers and sending; channels + the feature flag come from ChatContext (shared
 * with the floating button). `layout="split"`: channel list left, thread right (expanded
 * drawer). `layout="stack"`: channel chips above the thread, like the phone app.
 *
 * Reactions update the open page optimistically, then take the server's list for that
 * message; on failure a toast shows and the thread is refetched. Others' reactions
 * arrive with the poll.
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
  blockChatUser,
  clearChatReaction,
  listBlockedChatUsers,
  listChatMessages,
  markChatChannelRead,
  reportChatMessage,
  sendChatMessage,
  setChatReaction,
  unblockChatUser,
  type BlockedUser,
  type ChatMessage,
  type ChatMessagePage,
  type ChatReaction,
} from "@/lib/api/chat-client";
import { toggleReaction, type ReactionEmoji } from "@/lib/chat/reactions";
import { seenByMessage } from "@/lib/chat/seen-by";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatBlockedDialog } from "@/components/chat/chat-blocked-dialog";
import { ChatChannelList } from "@/components/chat/chat-channel-list";
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

/** Replace one message's reactions in a page (no-op once the page moved to another channel). */
function withReactions(
  page: ChatMessagePage | null,
  messageId: string,
  reactions: ChatReaction[]
): ChatMessagePage | null {
  if (!page || !page.items.some((m) => m.id === messageId)) return page;
  return {
    ...page,
    items: page.items.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
  };
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
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { enabled, channels, channelsLoaded, channelsError, refreshChannels } = useChat();

  const [selected, setSelected] = useState<string | null>(initialChannelKey ?? null);
  // Compact layouts: the conversation list is a screen of its own, reached with the back arrow.
  const [showList, setShowList] = useState(false);
  // Opened again on another channel (the bell) while the drawer is already open: follow it.
  const [seenInitial, setSeenInitial] = useState(initialChannelKey);
  if (initialChannelKey !== seenInitial) {
    setSeenInitial(initialChannelKey);
    if (initialChannelKey) {
      setSelected(initialChannelKey);
      setShowList(false);
    }
  }
  // The requested channel can be newer than the polled list (a project the user was just added
  // to): fetch the list now instead of showing a default channel until the next 30 s poll.
  useEffect(() => {
    if (selected && channelsLoaded && !channels.some((c) => c.key === selected)) void refreshChannels();
    // Only when the requested channel changes; a refreshed list that still lacks it must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, channelsLoaded]);
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

  const viewerId = user?.id ?? null;
  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: ReactionEmoji) => {
      const message = page?.items.find((m) => m.id === messageId);
      if (!viewerId || !message) return;
      const next = toggleReaction(message.reactions ?? [], viewerId, emoji);
      setPage((current) => withReactions(current, messageId, next.reactions));
      try {
        const reactions = next.remove
          ? await clearChatReaction(messageId)
          : await setChatReaction(messageId, emoji);
        setPage((current) => withReactions(current, messageId, reactions));
      } catch (error) {
        toast.error(
          t(error instanceof ChatApiError && error.status === 403 ? "errors.forbidden" : "errors.reactFailed")
        );
        await refreshMessages();
      }
    },
    [page, viewerId, refreshMessages, t]
  );

  // ---- Report / block (App Store guideline 1.2) ----
  const [pendingModeration, setPendingModeration] = useState<{
    action: "report" | "block";
    message: ChatMessage;
  } | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const refreshBlocked = useCallback(async () => {
    try {
      setBlocked(await listBlockedChatUsers());
    } catch {
      // The list is a convenience; the next block/unblock refreshes it again.
    }
  }, []);
  useEffect(() => {
    if (enabled === true) void refreshBlocked();
  }, [enabled, refreshBlocked]);

  const confirmModeration = useCallback(async () => {
    const pending = pendingModeration;
    setPendingModeration(null);
    if (!pending) return;
    try {
      if (pending.action === "report") {
        await reportChatMessage(pending.message.id);
        toast.success(t("moderation.reported"));
      } else if (pending.message.sender_id) {
        await blockChatUser(pending.message.sender_id);
        toast.success(t("moderation.blocked"));
        await Promise.all([refreshBlocked(), refreshMessages(), refreshChannels()]);
      }
    } catch {
      toast.error(t("moderation.failed"));
    }
  }, [pendingModeration, refreshBlocked, refreshMessages, refreshChannels, t]);

  const handleUnblock = useCallback(
    async (userId: string) => {
      try {
        await unblockChatUser(userId);
        await Promise.all([refreshBlocked(), refreshMessages(), refreshChannels()]);
      } catch {
        toast.error(t("moderation.failed"));
      }
    },
    [refreshBlocked, refreshMessages, refreshChannels, t]
  );

  const handleReject = useCallback(
    (reason: ComposerRejection) => toast.error(t(`errors.${reason}`)),
    [t]
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
          <div className="px-2.5 pb-2 pt-1 text-[20px] font-bold">{t("channels")}</div>
          <ChatChannelList channels={channels} selectedKey={channelKey} onSelect={setSelected} />
        </aside>
      ) : null}

      {layout === "stack" && showList ? (
        <section className="flex min-w-0 flex-1 flex-col" data-testid="chat-list-screen">
          <div className="px-4 pb-2 pt-3 text-[22px] font-bold">{t("title")}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <ChatChannelList
              channels={channels}
              selectedKey={channelKey}
              onSelect={(key) => {
                setSelected(key);
                setShowList(false);
              }}
            />
          </div>
        </section>
      ) : (
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatThreadHeader
          channel={channel}
          members={members}
          onBack={layout === "stack" ? () => setShowList(true) : undefined}
        />

        {blocked.length > 0 ? (
          <div className="flex justify-end border-b px-4 py-1" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              className="text-[11.5px] underline-offset-2 hover:underline"
              style={{ color: "var(--muted)" }}
              data-testid="chat-blocked-open"
              onClick={() => setBlockedOpen(true)}
            >
              {t("moderation.manage", { count: blocked.length })}
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ background: "var(--card)" }}
          data-testid="chat-scroll"
        >
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
                members={members}
                viewerId={viewerId}
                onToggleReaction={(messageId, emoji) => void handleToggleReaction(messageId, emoji)}
                onModerate={(action, message) => setPendingModeration({ action, message })}
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
      )}

      <ChatBlockedDialog
        open={blockedOpen}
        onOpenChange={setBlockedOpen}
        users={blocked}
        onUnblock={(userId) => void handleUnblock(userId)}
      />
      <AlertDialog open={pendingModeration !== null} onOpenChange={(o) => !o && setPendingModeration(null)}>
        <AlertDialogContent className="z-[90] max-w-sm" overlayClassName="z-[90]" data-testid="chat-moderation-confirm">
          <AlertDialogTitle>
            {pendingModeration?.action === "block"
              ? t("moderation.blockTitle", { name: pendingModeration.message.sender_name })
              : t("moderation.reportTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingModeration?.action === "block" ? t("moderation.blockBody") : t("moderation.reportBody")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("moderation.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmModeration()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="chat-moderation-confirm-button"
            >
              {pendingModeration?.action === "block" ? t("moderation.blockConfirm") : t("moderation.report")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
