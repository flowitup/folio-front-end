/**
 * The chat drawer renders only while open, hosts the panel on the requested channel, is a
 * support-chat widget (no backdrop) by default on desktop, expands to a full-height split
 * drawer with a backdrop, is a full-screen sheet on narrow viewports, and closes on the X,
 * the backdrop and Escape.
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

  it("opens as a widget (no backdrop) on the requested channel and expands to the split drawer", () => {
    render(<ChatDrawer />);
    const drawer = screen.getByTestId("chat-drawer");
    expect(drawer).toHaveAttribute("data-shape", "widget");
    expect(drawer).toHaveAttribute("aria-modal", "false");
    expect(screen.queryByTestId("chat-drawer-backdrop")).toBeNull();
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ initialChannelKey: "project:p1", layout: "stack" }));
    fireEvent.click(screen.getByTestId("chat-drawer-expand"));
    expect(screen.getByTestId("chat-drawer")).toHaveAttribute("data-shape", "drawer");
    expect(screen.getByTestId("chat-drawer-backdrop")).toBeInTheDocument();
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ layout: "split" }));
  });

  it("is a full-screen sheet on narrow viewports, without the expand toggle", () => {
    mockDesktop = false;
    render(<ChatDrawer />);
    expect(screen.getByTestId("chat-drawer")).toHaveAttribute("data-shape", "sheet");
    expect(screen.queryByTestId("chat-drawer-expand")).toBeNull();
    expect(screen.getByTestId("chat-drawer-backdrop")).toBeInTheDocument();
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ layout: "stack" }));
  });

  it("closes on the X button, Escape, and the backdrop once expanded", () => {
    render(<ChatDrawer />);
    fireEvent.click(screen.getByTestId("chat-drawer-close"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("chat-drawer-expand"));
    fireEvent.click(screen.getByTestId("chat-drawer-backdrop"));
    expect(mockClose).toHaveBeenCalledTimes(3);
  });
});
