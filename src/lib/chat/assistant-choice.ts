/**
 * Pure helpers for an assistant `content_type: "choice"` message's payload — the shape
 * `AssistantMessenger.post_choice` writes (`app/application/assistant/messages.py`) and
 * `SubmitAssistantActionUseCase` answers (`app/application/assistant/service.py`). Kept
 * dependency-free (no React) so it is trivial to unit test; mirrors the mobile app's
 * `src/lib/chat/assistant.ts` (choice-only subset — web has no card/job_status payload yet).
 */

export interface AssistantChoiceOption {
  label: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface AssistantChoicePayload {
  prompt: string;
  options: AssistantChoiceOption[];
  answered: string | null;
  /** The option payload the server recorded with the answer (absent on older servers, or
   * an answer that predates this field). */
  answeredPayload: Record<string, unknown> | null;
  /** The user id this choice was addressed to; `null` on older servers (nobody is
   * distinguished as "addressed" — the read-only rendering applies to everyone). */
  addressedTo: string | null;
}

/** The shape `ChatMessage.payload` carries: an untyped JSON object, or `null`/`undefined`. */
export type RawChatPayload = Record<string, unknown> | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Stable comparison of two option payloads (key order does not matter). */
function samePayload(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const normalise = (value: unknown): string =>
    JSON.stringify(value, (_key, inner) =>
      isRecord(inner) && !Array.isArray(inner)
        ? Object.fromEntries(
            Object.keys(inner)
              .sort()
              .map((k) => [k, inner[k]])
          )
        : inner
    );
  return normalise(a) === normalise(b);
}

/**
 * Whether `option` is the one that answered the choice. Several options can share an
 * `action` (two "set_project" buttons differ only by payload), so the action alone is not
 * enough; the recorded payload decides when both are available.
 */
export function isChosenOption(
  option: AssistantChoiceOption,
  answered: string | null,
  answeredPayload: Record<string, unknown> | null
): boolean {
  if (answered === null || answered !== option.action) return false;
  if (answeredPayload === null) return true;
  return samePayload(option.payload, answeredPayload);
}

/** Parses a `content_type: "choice"` message payload; `null` on anything malformed (the
 * caller falls back to the plain text body instead of rendering nothing). */
export function parseChoicePayload(raw: RawChatPayload): AssistantChoicePayload | null {
  if (!isRecord(raw) || typeof raw.prompt !== "string" || !Array.isArray(raw.options)) return null;
  const options: AssistantChoiceOption[] = [];
  for (const entry of raw.options) {
    if (!isRecord(entry) || typeof entry.label !== "string" || typeof entry.action !== "string") return null;
    options.push({
      label: entry.label,
      action: entry.action,
      payload: isRecord(entry.payload) ? entry.payload : {},
    });
  }
  return {
    prompt: raw.prompt,
    options,
    answered: typeof raw.answered === "string" ? raw.answered : null,
    answeredPayload: isRecord(raw.answered_payload) ? raw.answered_payload : null,
    addressedTo: typeof raw.addressed_to === "string" ? raw.addressed_to : null,
  };
}
