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

interface TagSelectProps {
  tags: ProjectTag[];
  value: string | null | undefined;
  onChange: (tagId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
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
}: TagSelectProps) {
  const t = useTranslations("tags");

  function handleValueChange(v: string) {
    onChange(v === NO_TAG_VALUE ? null : v);
  }

  const selectValue = value ?? NO_TAG_VALUE;

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
          {selectValue !== NO_TAG_VALUE ? (
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
