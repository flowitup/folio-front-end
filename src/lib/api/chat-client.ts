"use client";

/**
 * Browser-direct client for the team chat API (same channels as the mobile app).
 *
 * Chat polls every few seconds while a thread is open and sends images as multipart,
 * so every call goes straight from the browser to the backend with the HttpOnly cookie
 * (credentials:"include") + CSRF header — never through a server action (latency and
 * the 1 MB action body cap). Mirrors `project-photo-blob.ts`: retry once after a 401
 * by refreshing the access cookie.
 *
 * Contract (backend `app/api/v1/chat/routes.py`):
 *   GET  /features                              → { chat: boolean }
 *   GET  /chat/channels                         → { items: ChatChannel[] }
 *   GET  /chat/channels/<key>/messages?limit=N  → { items: ChatMessage[] (oldest first), members }
 *   POST /chat/channels/<key>/messages          → 201 ChatMessage (JSON {body} or multipart body+file)
 *   POST /chat/channels/<key>/read              → 204
 *   GET  /chat/messages/<id>/attachment         → image bytes
 */

import { getCsrfHeader } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";

// ---- Types (snake_case, as sent by the backend) ----

export interface ChatFeatures {
  chat: boolean;
}

export type ChatChannelKind = "company" | "project";

export interface ChatChannel {
  /** `company:<uuid>` or `project:<uuid>`. */
  key: string;
  kind: ChatChannelKind;
  id: string;
  name: string;
  member_count: number;
  unread_count: number;
  last_message_at: string | null;
}

export interface ChatAttachment {
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface ChatMessage {
  id: string;
  channel_key: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  attachment: ChatAttachment | null;
  created_at: string;
  mine: boolean;
}

export interface ChatMember {
  id: string;
  name: string;
  /** Read marker of the member (null until they open the channel); drives "seen" avatars. */
  last_read_at?: string | null;
}

export interface ChatMessagePage {
  items: ChatMessage[];
  members: ChatMember[];
}

/** Image types the web composer may upload (`ALLOWED_IMAGE_TYPES` on the backend). */
export const CHAT_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/**
 * Voice-note types the backend stores (`ALLOWED_AUDIO_TYPES`). A recording arrives from the
 * mobile app under whichever name that device gave the same AAC/m4a file — iOS says
 * `audio/x-m4a`, Android says `audio/mpeg` — so the whole family has to be understood here.
 * The web composer does not offer them; this list is only for playing back what it receives.
 */
export const CHAT_AUDIO_TYPES = [
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/mp4a-latm",
  "audio/mpeg",
] as const;

/** Whether an attachment is a voice note rather than a picture. */
export function isVoiceNote(contentType: string): boolean {
  return (CHAT_AUDIO_TYPES as readonly string[]).includes(contentType.toLowerCase());
}

/**
 * The type a downloaded attachment may be handed to the browser as. Anything outside the two
 * allowlists becomes an inert download, so a stored attachment can never render as a document.
 *
 * The AAC/m4a container is passed on as `audio/mp4`, the name media elements actually know: a
 * recorder may label the very same file `audio/x-m4a` or `audio/mpeg`, and the second is simply
 * wrong — handed over as served it sends the decoder looking for an MP3 frame header.
 */
export function playableAttachmentType(served: string): string {
  if ((CHAT_ATTACHMENT_TYPES as readonly string[]).includes(served)) return served;
  if (isVoiceNote(served)) return "audio/mp4";
  return "application/octet-stream";
}
/** Backend `MAX_ATTACHMENT_BYTES`. */
export const CHAT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Newest messages loaded per thread (backend caps at 200). */
export const CHAT_PAGE_SIZE = 100;

export class ChatApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string } | null
  ) {
    super(`chat_request_failed:${status}`);
    this.name = "ChatApiError";
  }
}

// ---- Transport ----

async function chatFetch(
  path: string,
  init: RequestInit & { method: "GET" | "POST" },
  signal?: AbortSignal
): Promise<Response> {
  const url = `${env.apiBaseUrl}${path}`;
  const send = () =>
    fetch(url, {
      ...init,
      headers: { ...getCsrfHeader(init.method), ...(init.headers ?? {}) },
      credentials: "include",
      signal,
    });

  let res = await send();
  if (res.status === 401 && (await refreshAccessTokenViaCookie())) {
    res = await send();
  }
  if (!res.ok) {
    let body: { error?: string; message?: string } | null = null;
    try {
      body = (await res.json()) as { error?: string; message?: string };
    } catch {
      // Non-JSON body — leave null.
    }
    throw new ChatApiError(res.status, body);
  }
  return res;
}

async function chatJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await chatFetch(path, { method: "GET" }, signal);
  return (await res.json()) as T;
}

// ---- Wrappers ----

/** Feature flags of this deployment; `chat` is false on servers without FEATURE_CHAT. */
export function fetchChatFeatures(signal?: AbortSignal): Promise<ChatFeatures> {
  return chatJson<ChatFeatures>("/features", signal);
}

/** Every channel the caller belongs to (company channels first), with unread counts. */
export async function listChatChannels(signal?: AbortSignal): Promise<ChatChannel[]> {
  const page = await chatJson<{ items: ChatChannel[] }>("/chat/channels", signal);
  return page.items;
}

/** Newest `limit` messages of a channel (oldest first) plus its members. */
export function listChatMessages(
  channelKey: string,
  opts: { limit?: number } = {},
  signal?: AbortSignal
): Promise<ChatMessagePage> {
  const limit = opts.limit ?? CHAT_PAGE_SIZE;
  return chatJson<ChatMessagePage>(
    `/chat/channels/${encodeURIComponent(channelKey)}/messages?limit=${limit}`,
    signal
  );
}

/**
 * Send text and/or one image. Text-only goes as JSON; with a file the request is
 * multipart/form-data (`body` part optional). The backend rejects an empty message.
 */
export async function sendChatMessage(
  channelKey: string,
  input: { body: string; file?: File | null }
): Promise<ChatMessage> {
  const path = `/chat/channels/${encodeURIComponent(channelKey)}/messages`;
  const text = input.body.trim();
  let res: Response;
  if (input.file) {
    const form = new FormData();
    form.append("file", input.file, input.file.name);
    if (text) form.append("body", text);
    // No Content-Type header: the browser sets multipart/form-data with the boundary.
    res = await chatFetch(path, { method: "POST", body: form });
  } else {
    res = await chatFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
  }
  return (await res.json()) as ChatMessage;
}

/** Move the caller's read marker of a channel to now. */
export async function markChatChannelRead(channelKey: string): Promise<void> {
  await chatFetch(`/chat/channels/${encodeURIComponent(channelKey)}/read`, { method: "POST" });
}

export interface ChatBlob {
  objectUrl: string;
  revoke: () => void;
}

/**
 * Fetch a message attachment as an authenticated blob and return an object URL.
 * The caller revokes it when the image unmounts.
 */
export async function fetchChatAttachmentBlob(
  messageId: string,
  signal?: AbortSignal
): Promise<ChatBlob> {
  const res = await chatFetch(
    `/chat/messages/${encodeURIComponent(messageId)}/attachment`,
    { method: "GET" },
    signal
  );
  // Rebuild the blob with an allowlisted type: a blob: URL runs same-origin, so a stored
  // attachment ever served as text/html must never render as a document.
  const served = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const type = playableAttachmentType(served);
  const blob = new Blob([await res.arrayBuffer()], { type });
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}
