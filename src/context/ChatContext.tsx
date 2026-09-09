"use client";

/**
 * ChatContext — one place that knows whether chat is enabled, keeps the channel list
 * (with unread counts) fresh for the whole app shell (one channel poll per tab, 30 s ± 5 s,
 * paused while hidden), and owns the open/closed state of the chat drawer so the floating
 * button and the drawer stay in sync.
 *
 * `useChat()` outside a provider returns the "off" state so shell components stay
 * renderable in isolation (tests, storybook-style previews).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { listChatChannels, type ChatChannel } from "@/lib/api/chat-client";
import { useChatFeature } from "@/hooks/use-chat-feature";
import { useVisiblePoll } from "@/hooks/use-visible-poll";

export const CHAT_CHANNELS_POLL_MS = 30_000;
export const CHAT_CHANNELS_JITTER_MS = 5_000;

interface ChatContextValue {
  /** `true` once the backend confirmed the feature; `false` when off; `null` while unknown. */
  enabled: boolean | null;
  channels: ChatChannel[];
  /** Whether the first channel fetch has completed. */
  channelsLoaded: boolean;
  /** Last channel fetch failed (cleared by the next success); lets /chat offer a retry. */
  channelsError: boolean;
  /** Sum of unread counts across channels (badge). */
  unread: number;
  /** Refetch channels now (after sending or marking read). */
  refreshChannels: () => Promise<void>;
  /** Whether the chat drawer is open. */
  isOpen: boolean;
  /** Channel the drawer was asked to open on (null = default resolution). */
  requestedChannelKey: string | null;
  openChat: (channelKey?: string | null) => void;
  closeChat: () => void;
}

const OFF: ChatContextValue = {
  enabled: false,
  channels: [],
  channelsLoaded: false,
  channelsError: false,
  unread: 0,
  refreshChannels: async () => {},
  isOpen: false,
  requestedChannelKey: null,
  openChat: () => {},
  closeChat: () => {},
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const enabled = useChatFeature();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [channelsError, setChannelsError] = useState(false);

  const onUpdate = useCallback((items: ChatChannel[]) => {
    setChannels(items);
    setChannelsLoaded(true);
    setChannelsError(false);
  }, []);
  const onError = useCallback(() => setChannelsError(true), []);
  const [isOpen, setIsOpen] = useState(false);
  const [requestedChannelKey, setRequestedChannelKey] = useState<string | null>(null);
  const openChat = useCallback((channelKey?: string | null) => {
    setRequestedChannelKey(channelKey ?? null);
    setIsOpen(true);
  }, []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  const { refresh } = useVisiblePoll({
    enabled: enabled === true,
    intervalMs: CHAT_CHANNELS_POLL_MS,
    jitterMs: CHAT_CHANNELS_JITTER_MS,
    fetcher: (signal) => listChatChannels(signal),
    onUpdate,
    onError,
  });

  const value = useMemo<ChatContextValue>(
    () => ({
      enabled,
      channels,
      channelsLoaded,
      channelsError,
      unread: channels.reduce((sum, channel) => sum + channel.unread_count, 0),
      refreshChannels: refresh,
      isOpen,
      requestedChannelKey,
      openChat,
      closeChat,
    }),
    [enabled, channels, channelsLoaded, channelsError, refresh, isOpen, requestedChannelKey, openChat, closeChat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  return useContext(ChatContext) ?? OFF;
}
