/**
 * The chat drawer renders only while open, hosts the panel on the requested channel,
 * toggles between compact and split layouts on desktop, and closes on the X, the backdrop
 * and Escape.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

const panelProps = vi.fn();
vi.mock("@/components/chat/chat-panel", () => ({
  ChatPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return <div data-testid="chat-panel-stub" />;
  },
}));

let mockDesktop = true;
vi.mock("@/hooks/use-is-desktop", () => ({
  useIsDesktop: () => mockDesktop,
}));

const mockClose = vi.fn();
const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({
  useChat: () => mockUseChat(),
}));

import { ChatDrawer } from "@/components/chat/chat-drawer";

beforeEach(() => {
  vi.clearAllMocks();
  mockDesktop = true;
  mockUseChat.mockReturnValue({ isOpen: true, requestedChannelKey: "project:p1", closeChat: mockClose });
});

describe("ChatDrawer", () => {
  it("renders nothing while closed", () => {
    mockUseChat.mockReturnValue({ isOpen: false, requestedChannelKey: null, closeChat: mockClose });
    render(<ChatDrawer />);
    expect(screen.queryByTestId("chat-drawer")).toBeNull();
    expect(panelProps).not.toHaveBeenCalled();
  });

  it("opens compact on the requested channel and expands to the split layout", () => {
    render(<ChatDrawer />);
    expect(screen.getByTestId("chat-drawer")).toHaveAttribute("data-expanded", "false");
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ initialChannelKey: "project:p1", layout: "stack" }));
    fireEvent.click(screen.getByTestId("chat-drawer-expand"));
    expect(screen.getByTestId("chat-drawer")).toHaveAttribute("data-expanded", "true");
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ layout: "split" }));
  });

  it("never splits on narrow viewports and hides the expand toggle", () => {
    mockDesktop = false;
    render(<ChatDrawer />);
    expect(screen.queryByTestId("chat-drawer-expand")).toBeNull();
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ layout: "stack" }));
  });

  it("closes on the X button, the backdrop and Escape", () => {
    render(<ChatDrawer />);
    fireEvent.click(screen.getByTestId("chat-drawer-close"));
    fireEvent.click(screen.getByTestId("chat-drawer-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockClose).toHaveBeenCalledTimes(3);
  });
});
