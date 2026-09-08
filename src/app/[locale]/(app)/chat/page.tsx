/**
 * Team chat page — server shell around the client ChatPanel.
 * Auth is enforced by the (app) layout. `?channel=project:<id>` deep-links a channel
 * (same param the mobile app uses). The page fills the visible area through a definite
 * h-full chain (the app shell's zoom wrapper is h-full), never vh math.
 */

import { ChatPanel } from "@/components/chat/chat-panel";

interface PageProps {
  searchParams: Promise<{ channel?: string | string[] }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const { channel } = await searchParams;
  const initialChannelKey = typeof channel === "string" ? channel : null;
  return (
    <div className="h-full px-4 pb-4 lg:px-8 lg:pb-6">
      <div className="folio-card h-full overflow-hidden">
        <ChatPanel initialChannelKey={initialChannelKey} />
      </div>
    </div>
  );
}
