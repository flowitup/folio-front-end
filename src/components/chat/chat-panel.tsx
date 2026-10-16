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
 * else the first channel (company channels come first from the backend). A requested or open
 * channel the user can no longer reach (removed from the project, a stale bell entry) is never
 * swapped for another one silently: a notice says so and the list opens.
 *
 * History: the poll keeps the newest page fresh; scrolling to the top (or the "load earlier"
 * button) pages back with `before`, keeping the reading position. A message that slides out of
 * the newest page is kept, so the thread never develops a gap.
 *
 * Scrolling and read markers: the thread follows new messages only while the reader is at the
 * bottom (or just sent one); otherwise a "new messages" pill appears. The channel is marked read
 * when its newest message is on screen, compared by message id (never the PC clock against the
 * server's), and only while the thread itself is shown, not the channel list.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  CHAT_OLDER_PAGE_SIZE,
  CHAT_PAGE_SIZE,
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
import { chatPersonName } from "@/lib/chat/person-name";
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
/** How close to the bottom (px) still counts as "reading the newest messages". */
const NEAR_BOTTOM_PX = 80;
/** How close to the top (px) starts loading earlier messages. */
const NEAR_TOP_PX = 120;

function sendErrorKey(error: unknown): string {
  if (error instanceof ChatApiError) {
    if (error.status === 413) return "errors.tooLarge";
    if (error.status === 415) return "errors.unsupportedType";
    if (error.status === 403) return "errors.forbidden";
    if (error.status === 400 || error.status === 422) {
      const message = error.body?.message ?? "";
      if (/4000|body/i.test(message)) return "errors.bodyTooLong";
    }
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

function withReactionsIn(list: ChatMessage[], messageId: string, reactions: ChatReaction[]): ChatMessage[] {
  return list.some((m) => m.id === messageId)
    ? list.map((m) => (m.id === messageId ? { ...m, reactions } : m))
    : list;
}

/** Older messages first, newest page last, each message once. */
function mergeHistory(older: ChatMessage[], newest: ChatMessage[]): ChatMessage[] {
  const seen = new Set(newest.map((m) => m.id));
  return [...older.filter((m) => !seen.has(m.id)), ...newest];
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
  const isDesktop = useIsDesktop();

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
  // Channels the server refused (403) while open: never resolved again in this panel, even
  // while the 30 s channel list still carries them.
  const [deniedKeys, setDeniedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const visibleChannels = useMemo(
    () => channels.filter((c) => !deniedKeys.has(c.key)),
    [channels, deniedKeys]
  );
  const has = useCallback(
    (key: string | null) => Boolean(key) && visibleChannels.some((c) => c.key === key),
    [visibleChannels]
  );

  // The requested channel can be newer than the polled list (a project the user was just added
  // to): fetch the list now. If it is still missing afterwards, the user lost access to it.
  const [checkedMissing, setCheckedMissing] = useState<string | null>(null);
  useEffect(() => {
    if (!selected || !channelsLoaded || has(selected) || deniedKeys.has(selected)) return;
    let cancelled = false;
    const key = selected;
    void refreshChannels().finally(() => {
      if (!cancelled) setCheckedMissing(key);
    });
    return () => {
      cancelled = true;
    };
    // Only when the requested channel changes; a refreshed list that still lacks it must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, channelsLoaded]);

  const loseChannel = useCallback(
    (key: string) => {
      toast.error(t("noLongerAvailable"));
      setDeniedKeys((current) => new Set(current).add(key));
      setSelected((current) => (current === key ? null : current));
      setShowList(true);
    },
    [t]
  );
  const selectedLost =
    Boolean(selected) && (deniedKeys.has(selected ?? "") || (checkedMissing === selected && !has(selected)));
  useEffect(() => {
    if (selectedLost && selected) loseChannel(selected);
  }, [selectedLost, selected, loseChannel]);

  const channelKey = useMemo(() => {
    if (selected) return has(selected) ? selected : null;
    const projectKey = selectedProjectId ? `project:${selectedProjectId}` : null;
    if (has(projectKey)) return projectKey;
    return visibleChannels[0]?.key ?? null;
  }, [has, selected, selectedProjectId, visibleChannels]);
  const channel = visibleChannels.find((c) => c.key === channelKey) ?? null;
  // Latch the resolved default so a re-ordered channel poll can never move the open thread
  // (and mark a channel read) without a click.
  useEffect(() => {
    if (!selected && channelKey) setSelected(channelKey);
  }, [selected, channelKey]);

  const [page, setPage] = useState<ChatMessagePage | null>(null);
  // Messages older than the polled newest page: loaded on demand, or slid out of the page.
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [liveText, setLiveText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<ChatMessagePage | null>(null);
  // Whether the reader is at the newest messages; only a scroll by the user turns it off.
  const atBottomRef = useRef(true);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);

  // The thread is "shown" unless the compact layout is on its channel-list screen; a hidden
  // thread is neither polled nor marked read.
  const threadShown = !(layout === "stack" && showList);
  // Nothing polls unless the backend confirmed the feature, even if stale channels linger.
  const active = enabled === true && Boolean(channelKey) && threadShown;
  const { refresh: refreshMessages } = useVisiblePoll<ChatMessagePage>({
    enabled: active,
    resetKey: channelKey,
    intervalMs: CHAT_MESSAGES_POLL_MS,
    fetcher: (signal) => listChatMessages(channelKey ?? "", {}, signal),
    onUpdate: useCallback((next: ChatMessagePage) => {
      const previous = pageRef.current;
      if (previous === null) {
        setHasOlder(next.items.length >= CHAT_PAGE_SIZE);
      } else if (next.items.length > 0) {
        // Messages pushed out of the newest page by new ones stay in the thread.
        const firstAt = Date.parse(next.items[0].created_at);
        const ids = new Set(next.items.map((m) => m.id));
        const slid = previous.items.filter((m) => !ids.has(m.id) && Date.parse(m.created_at) < firstAt);
        if (slid.length > 0) setOlder((current) => mergeHistory(current, slid));
      }
      pageRef.current = next;
      setPage(next);
      setLoadFailed(false);
    }, []),
    onError: useCallback(
      (error: unknown) => {
        // Removed from the channel while it is open: say so instead of showing stale messages.
        if (error instanceof ChatApiError && (error.status === 403 || error.status === 404) && channelKey) {
          loseChannel(channelKey);
          void refreshChannels();
          return;
        }
        setLoadFailed(true);
      },
      [channelKey, loseChannel, refreshChannels]
    ),
  });

  // Switching channels: drop the previous thread during the same render, so the old messages
  // never flash (or get scrolled / marked read) under the new header.
  const [threadKey, setThreadKey] = useState(channelKey);
  if (threadKey !== channelKey) {
    setThreadKey(channelKey);
    setPage(null);
    setOlder([]);
    setHasOlder(false);
    setNewBelow(false);
    setLoadFailed(false);
  }
  const announcedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    pageRef.current = null;
    atBottomRef.current = true;
    announcedRef.current = null;
  }, [channelKey]);

  // One POST /read per newest message, compared by id: the PC clock never decides.
  const markedRef = useRef<{ key: string; token: string } | null>(null);
  const markRead = useCallback(
    async (key: string, token: string) => {
      const marked = markedRef.current;
      if (marked && marked.key === key && marked.token === token) return;
      markedRef.current = { key, token };
      try {
        await markChatChannelRead(key);
        await refreshChannels();
      } catch {
        // Read markers are best effort; the next message or open retries.
        if (markedRef.current?.key === key && markedRef.current.token === token) markedRef.current = null;
      }
    },
    [refreshChannels]
  );

  const items = useMemo(() => mergeHistory(older, page?.items ?? []), [older, page]);
  const members = page?.members ?? [];
  const lastMessage = page?.items[page.items.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageMine = lastMessage?.mine ?? false;

  const markNewestRead = useCallback(() => {
    if (!active || !channelKey || !pageRef.current) return;
    const newest = pageRef.current.items[pageRef.current.items.length - 1];
    // The server already moved the sender's marker when they sent their own message.
    if (newest?.mine && markedRef.current?.key === channelKey) return;
    void markRead(channelKey, newest?.id ?? "empty");
  }, [active, channelKey, markRead]);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    atBottomRef.current = true;
    setNewBelow(false);
  }, []);

  // A new newest message: follow it only if the reader is at the bottom or sent it; otherwise
  // keep their place and offer the pill. Reading it (being at the bottom) marks the channel read.
  useLayoutEffect(() => {
    if (!page) return;
    const firstLoad = announcedRef.current === null;
    if (firstLoad || atBottomRef.current || lastMessageMine) {
      scrollToBottom();
      markNewestRead();
    } else if (lastMessageId && lastMessageId !== announcedRef.current) {
      setNewBelow(true);
    }
    if (!firstLoad && lastMessage && !lastMessage.mine && lastMessageId !== announcedRef.current) {
      const who = chatPersonName(lastMessage.sender_name, lastMessage.sender_state, t);
      setLiveText(t("newMessageFrom", { name: who, text: lastMessage.body ?? t("attachment") }));
    }
    announcedRef.current = lastMessageId ?? "";
    // Runs per newest message (and once per channel for the first page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId, channelKey, page === null]);

  // Keep the reading position when earlier messages are prepended.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    const node = scrollRef.current;
    if (!anchor || !node) return;
    prependAnchorRef.current = null;
    node.scrollTop = node.scrollHeight - anchor.height + anchor.top;
  }, [older]);

  const loadOlder = useCallback(async () => {
    if (!channelKey || loadingOlder || !hasOlder) return;
    const oldest = items[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const result = await listChatMessages(channelKey, { limit: CHAT_OLDER_PAGE_SIZE, before: oldest.created_at });
      if (pageRef.current === null) return; // channel switched meanwhile
      const node = scrollRef.current;
      if (node) prependAnchorRef.current = { height: node.scrollHeight, top: node.scrollTop };
      setOlder((current) => mergeHistory(result.items, current));
      setHasOlder(result.items.length >= CHAT_OLDER_PAGE_SIZE);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoadingOlder(false);
    }
  }, [channelKey, hasOlder, items, loadingOlder, t]);

  const onThreadScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setNewBelow(false);
      markNewestRead();
    }
    if (node.scrollTop < NEAR_TOP_PX && hasOlder && !loadingOlder) void loadOlder();
  }, [hasOlder, loadOlder, loadingOlder, markNewestRead]);

  const seen = useMemo(() => seenByMessage(items, members, user?.id), [items, members, user?.id]);

  const handleSend = useCallback(
    async (input: { body: string; file: File | null }): Promise<boolean> => {
      if (!channelKey) return false;
      setSending(true);
      try {
        await sendChatMessage(channelKey, input);
        // The reader's own message brings the thread back to the bottom.
        atBottomRef.current = true;
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
      const message = items.find((m) => m.id === messageId);
      if (!viewerId || !message) return;
      const next = toggleReaction(message.reactions ?? [], viewerId, emoji);
      setPage((current) => withReactions(current, messageId, next.reactions));
      setOlder((current) => withReactionsIn(current, messageId, next.reactions));
      try {
        const reactions = next.remove
          ? await clearChatReaction(messageId)
          : await setChatReaction(messageId, emoji);
        setPage((current) => withReactions(current, messageId, reactions));
        setOlder((current) => withReactionsIn(current, messageId, reactions));
      } catch (error) {
        toast.error(
          t(error instanceof ChatApiError && error.status === 403 ? "errors.forbidden" : "errors.reactFailed")
        );
        await refreshMessages();
      }
    },
    [items, viewerId, refreshMessages, t]
  );

  // ---- Report / block (App Store guideline 1.2) ----
  const [pendingModeration, setPendingModeration] = useState<{
    action: "report" | "block";
    message: ChatMessage;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
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
    const reason = reportReason;
    setPendingModeration(null);
    setReportReason("");
    if (!pending) return;
    try {
      if (pending.action === "report") {
        if (reason.trim()) await reportChatMessage(pending.message.id, reason);
        else await reportChatMessage(pending.message.id);
        toast.success(t("moderation.reported"));
      } else if (pending.message.sender_id) {
        await blockChatUser(pending.message.sender_id);
        toast.success(t("moderation.blocked"));
        // Their messages leave the whole thread, the earlier pages included.
        setOlder((current) => current.filter((m) => m.sender_id !== pending.message.sender_id));
        await Promise.all([refreshBlocked(), refreshMessages(), refreshChannels()]);
      }
    } catch {
      toast.error(t("moderation.failed"));
    }
  }, [pendingModeration, reportReason, refreshBlocked, refreshMessages, refreshChannels, t]);

  const handleUnblock = useCallback(
    async (userId: string) => {
      try {
        await unblockChatUser(userId);
        // Their earlier messages come back: page the history again from the newest.
        pageRef.current = null;
        setOlder([]);
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
          <ChatChannelList channels={visibleChannels} selectedKey={channelKey} onSelect={setSelected} />
        </aside>
      ) : null}

      {layout === "stack" && showList ? (
        <section className="flex min-w-0 flex-1 flex-col" data-testid="chat-list-screen">
          <div className="px-4 pb-2 pt-3 text-[22px] font-bold">{t("title")}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <ChatChannelList
              channels={visibleChannels}
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

        <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overflow-x-hidden"
          style={{ background: "var(--card)" }}
          data-testid="chat-scroll"
          onScroll={onThreadScroll}
        >
          <div className="flex min-h-full flex-col justify-end p-4">
            {page && hasOlder ? (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  className="btn btn-quiet text-[12px]"
                  disabled={loadingOlder}
                  onClick={() => void loadOlder()}
                  data-testid="chat-load-older"
                >
                  {loadingOlder ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                  {t("loadOlder")}
                </button>
              </div>
            ) : null}
            {page && !hasOlder && items.length > 0 ? (
              <div className="mb-2 text-center text-[11px]" style={{ color: "var(--muted-2)" }} data-testid="chat-history-start">
                {t("historyStart")}
              </div>
            ) : null}
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
        {newBelow ? (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium text-white shadow-md"
            style={{ background: "var(--chat-bubble-mine)" }}
            onClick={() => {
              scrollToBottom();
              markNewestRead();
            }}
            data-testid="chat-new-below"
          >
            <ArrowDown size={14} aria-hidden="true" />
            {t("newMessages")}
          </button>
        ) : null}
        </div>
        {/* Incoming messages are announced to screen readers without moving focus. */}
        <div className="sr-only" role="status" aria-live="polite" data-testid="chat-live">
          {liveText}
        </div>

        <ChatComposer
          key={channelKey ?? "none"}
          channelKey={channelKey}
          disabled={!channelKey}
          sending={sending}
          autoFocus={isDesktop}
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
      <AlertDialog
        open={pendingModeration !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingModeration(null);
            setReportReason("");
          }
        }}
      >
        <AlertDialogContent className="z-[90] max-w-sm" overlayClassName="z-[90]" data-testid="chat-moderation-confirm">
          <AlertDialogTitle>
            {pendingModeration?.action === "block"
              ? t("moderation.blockTitle", {
                  name: chatPersonName(pendingModeration.message.sender_name, pendingModeration.message.sender_state, t),
                })
              : t("moderation.reportTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingModeration?.action === "block" ? t("moderation.blockBody") : t("moderation.reportBody")}
          </AlertDialogDescription>
          {pendingModeration?.action === "report" ? (
            <label className="flex flex-col gap-1 text-[13px]">
              <span style={{ color: "var(--muted)" }}>{t("moderation.reasonLabel")}</span>
              <textarea
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("moderation.reasonPlaceholder")}
                className="resize-none rounded-md border px-2.5 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink)" }}
                data-testid="chat-report-reason"
              />
            </label>
          ) : null}
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
