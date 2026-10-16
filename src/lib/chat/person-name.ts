/**
 * Names of chat people as the apps show them. The server sends a placeholder name for an erased
 * account ("Deleted account") or a phone sign-up without a name ("Unnamed member") together with a
 * `state`, so the reader's own language is used instead of the English placeholder.
 */

import type { ChatAccountState } from "@/lib/api/chat-client";

type Translate = (key: "deletedAccount" | "unnamedMember") => string;

export function chatPersonName(
  name: string,
  state: ChatAccountState | null | undefined,
  t: Translate
): string {
  if (state === "deleted") return t("deletedAccount");
  if (state === "unnamed") return t("unnamedMember");
  return name;
}

/** Splits a message body into text and http(s) links, so links can be rendered clickable. */
export function splitLinks(text: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  const pattern = /\bhttps?:\/\/[^\s<>"]+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    // Trailing punctuation usually ends the sentence, not the URL.
    const url = match[0].replace(/[.,;:!?)\]»”'"]+$/u, "");
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
