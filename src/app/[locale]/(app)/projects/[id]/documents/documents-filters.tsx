"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ProjectDocumentKind } from "@/lib/api/project-documents";

// ---- Types ----

type Member = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type Props = {
  kinds: ProjectDocumentKind[];
  selectedTags: string[];
  availableTags: string[];
  uploaderId: string | null;
  members: Member[];
  onChange: (next: { kinds: ProjectDocumentKind[]; tags: string[]; uploaderId: string | null }) => void;
};

// ---- Kind chip options ----

const ALL_KINDS: ProjectDocumentKind[] = [
  "pdf",
  "image",
  "spreadsheet",
  "doc",
  "cad",
  "text",
  "other",
];

// ---- Helpers ----

function memberDisplayName(m: Member): string {
  const full = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return full || m.email || m.id;
}

// ---- Component ----

export function DocumentsFilters({ kinds, selectedTags, availableTags, uploaderId, members, onChange }: Props) {
  const t = useTranslations("documents.filter");
  const tKinds = useTranslations("documents.kinds");

  function toggleKind(kind: ProjectDocumentKind) {
    const next = kinds.includes(kind)
      ? kinds.filter((k) => k !== kind)
      : [...kinds, kind];
    onChange({ kinds: next, tags: selectedTags, uploaderId });
  }

  function selectAllKinds() {
    onChange({ kinds: [], tags: selectedTags, uploaderId });
  }

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onChange({ kinds, tags: next, uploaderId });
  }

  function clearTags() {
    onChange({ kinds, tags: [], uploaderId });
  }

  function handleUploaderChange(value: string) {
    onChange({ kinds, tags: selectedTags, uploaderId: value === "__anyone__" ? null : value });
  }

  function handleReset() {
    onChange({ kinds: [], tags: [], uploaderId: null });
  }

  const isAllActive = kinds.length === 0;
  const hasFilters = kinds.length > 0 || selectedTags.length > 0 || uploaderId !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Kind chips + Uploader */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Kind chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* All chip */}
          <button
            type="button"
            onClick={selectAllKinds}
            data-active={isAllActive}
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors
              data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary
              data-[active=false]:bg-transparent data-[active=false]:text-muted-foreground
              hover:bg-accent hover:text-accent-foreground"
          >
            {t("all")}
          </button>

          {ALL_KINDS.map((kind) => {
            const isActive = kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                data-active={isActive}
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors
                  data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary
                  data-[active=false]:bg-transparent data-[active=false]:text-muted-foreground
                  hover:bg-accent hover:text-accent-foreground"
              >
                {tKinds(kind)}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Uploader select */}
        <Select
          value={uploaderId ?? "__anyone__"}
          onValueChange={handleUploaderChange}
        >
          <SelectTrigger size="sm" className="w-auto min-w-[140px]">
            <SelectValue placeholder={t("anyUploader")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__anyone__">{t("anyUploader")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {memberDisplayName(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground"
          >
            {t("reset")}
          </Button>
        )}
      </div>

      {/* Row 2: Tag chips (only shown when tags exist) */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">{t("tags")}:</span>
          {availableTags.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                data-active={isActive}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
                  data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground
                  data-[active=false]:bg-transparent data-[active=false]:text-muted-foreground
                  hover:bg-accent hover:text-accent-foreground"
              >
                {tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={clearTags}
              className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              {t("clearTags")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
