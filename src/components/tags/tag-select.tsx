"use client";

/**
 * TagSelect — project-scoped phase tag picker.
 * Renders a shadcn Select with a color dot indicator for each tag.
 * Passes the selected tag's UUID (or null for "no tag") to onChange.
 */

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectTag } from "@/lib/api/tags";

// Sentinel value Radix uses when no item is selected / "no tag" is chosen.
const NO_TAG_VALUE = "__no_tag__";
// Sentinel used only when the day's entries disagree on tag_id (mixed state).
// There is no corresponding SelectItem — it exists purely so the controlled
// Select value differs from NO_TAG_VALUE, so picking "No tag" from a mixed
// day fires a real onValueChange instead of being a silent no-op.
const MIXED_VALUE = "__mixed__";

interface TagSelectProps {
  tags: ProjectTag[];
  value: string | null | undefined;
  onChange: (tagId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * True when the underlying entries disagree on tag_id. Forces the
   * controlled value to a dedicated sentinel (distinct from "no tag") so
   * that selecting "No tag" always emits a change event. Caller still
   * passes `value={null}` and a `placeholder` describing the mixed state.
   */
  mixed?: boolean;
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

export function TagSelect({
  tags,
  value,
  onChange,
  disabled,
  placeholder,
  mixed,
}: TagSelectProps) {
  const t = useTranslations("tags");

  function handleValueChange(v: string) {
    onChange(v === NO_TAG_VALUE ? null : v);
  }

  const selectValue = mixed ? MIXED_VALUE : (value ?? NO_TAG_VALUE);

  return (
    <Select
      value={selectValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder={placeholder ?? t("select.placeholder")}
        >
          {selectValue !== NO_TAG_VALUE && selectValue !== MIXED_VALUE ? (
            (() => {
              const tag = tags.find((tag) => tag.id === selectValue);
              return tag ? (
                <span className="flex items-center gap-2">
                  <ColorDot color={tag.color} />
                  {tag.name}
                </span>
              ) : null;
            })()
          ) : (
            <span className="text-muted-foreground">
              {placeholder ?? t("select.noTag")}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG_VALUE}>
          <span className="text-muted-foreground">{t("select.noTag")}</span>
        </SelectItem>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            <span className="flex items-center gap-2">
              <ColorDot color={tag.color} />
              {tag.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
