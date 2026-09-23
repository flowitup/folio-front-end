"use client";

/**
 * Assistant `choice` message content: the prompt plus its options, one per option. The
 * addressed user sees a button per option while the choice is unanswered and the assistant
 * feature is on (`canAnswer`); everyone else — and the addressed user once answered — sees
 * the same options as read-only text, with the answered one (if any) marked.
 */

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  isChosenOption,
  type AssistantChoiceOption,
} from "@/lib/chat/assistant-choice";

export function ChatAssistantChoice({
  prompt,
  options,
  answered,
  answeredPayload,
  canAnswer,
  pending,
  onSelect,
}: {
  prompt: string;
  options: AssistantChoiceOption[];
  answered: string | null;
  answeredPayload: Record<string, unknown> | null;
  /** Buttons render only when this is true: the addressed user, unanswered, assistant on. */
  canAnswer: boolean;
  /** This message's action request is in flight — every button stays disabled to prevent a
   * double submit. */
  pending: boolean;
  onSelect: (option: AssistantChoiceOption) => void;
}) {
  const t = useTranslations("chat");
  return (
    <div
      className="flex w-full flex-col gap-2 rounded-[14px] border px-3 py-[9px]"
      style={{ background: "var(--card)", borderColor: "var(--line)" }}
      data-testid="chat-assistant-choice"
    >
      <p className="whitespace-pre-wrap break-words text-[14px] leading-5" style={{ color: "var(--ink)" }}>
        {prompt}
      </p>
      {canAnswer ? (
        <div className="flex flex-col gap-1.5" data-testid="chat-assistant-choice-buttons">
          {options.map((option, index) => (
            <Button
              key={`${option.action}-${index}`}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onSelect(option)}
              data-testid={`chat-assistant-choice-option-${option.action}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-0.5 pl-4 text-[13px] leading-5" data-testid="chat-assistant-choice-readonly">
          {options.map((option, index) => {
            const chosen = isChosenOption(option, answered, answeredPayload);
            return (
              <li
                key={`${option.action}-${index}`}
                className={chosen ? "font-medium" : undefined}
                style={{ color: chosen ? "var(--ink)" : "var(--muted)" }}
                data-testid={chosen ? "chat-assistant-choice-answered" : undefined}
              >
                {option.label}
                {chosen ? ` — ${t("assistant.answered")}` : ""}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
