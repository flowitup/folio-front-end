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
  uploaderId: string | null;
  members: Member[];
  onChange: (next: { kinds: ProjectDocumentKind[]; uploaderId: string | null }) => void;
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

export function DocumentsFilters({ kinds, uploaderId, members, onChange }: Props) {
  const t = useTranslations("documents.filter");
  const tKinds = useTranslations("documents.kinds");

  function toggleKind(kind: ProjectDocumentKind) {
    const next = kinds.includes(kind)
      ? kinds.filter((k) => k !== kind)
      : [...kinds, kind];
    onChange({ kinds: next, uploaderId });
  }

  function selectAllKinds() {
    onChange({ kinds: [], uploaderId });
  }

  function handleUploaderChange(value: string) {
    onChange({ kinds, uploaderId: value === "__anyone__" ? null : value });
  }

  function handleReset() {
    onChange({ kinds: [], uploaderId: null });
  }

  const isAllActive = kinds.length === 0;
  const hasFilters = kinds.length > 0 || uploaderId !== null;

  return (
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
  );
}
