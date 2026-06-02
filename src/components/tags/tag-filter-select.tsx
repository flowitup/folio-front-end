"use client";

/**
 * TagFilterSelect — lightweight dropdown for filtering a list by phase tag.
 * Renders an "All tags" option (clears filter) plus one option per tag with
 * a color dot.  Calls onChange(tagId) when a tag is selected, onChange(null)
 * when "All" is picked.
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

const ALL_VALUE = "__all__";

interface TagFilterSelectProps {
  tags: ProjectTag[];
  /** Currently active filter — null / undefined means "all". */
  value: string | null | undefined;
  onChange: (tagId: string | null) => void;
  disabled?: boolean;
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

export function TagFilterSelect({
  tags,
  value,
  onChange,
  disabled,
}: TagFilterSelectProps) {
  const t = useTranslations("tags");

  function handleValueChange(v: string) {
    onChange(v === ALL_VALUE ? null : v);
  }

  const selectValue = value ?? ALL_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue>
          {selectValue === ALL_VALUE ? (
            <span className="text-muted-foreground">{t("filter.allTags")}</span>
          ) : (
            (() => {
              const tag = tags.find((tag) => tag.id === selectValue);
              return tag ? (
                <span className="flex items-center gap-1.5">
                  <ColorDot color={tag.color} />
                  {tag.name}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("filter.allTags")}</span>
              );
            })()
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>
          <span className="text-muted-foreground">{t("filter.allTags")}</span>
        </SelectItem>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            <span className="flex items-center gap-1.5">
              <ColorDot color={tag.color} />
              {tag.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
