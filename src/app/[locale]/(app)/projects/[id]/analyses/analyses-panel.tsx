"use client";

/**
 * AnalysesPanel — top-level client orchestrator for the analyses library page.
 * Manages: list state, search (debounced), tag filter, pagination, and the
 * upload/edit/delete flows.
 *
 * Tag filter data source: the project's whole tag vocabulary is fetched
 * server-side via `GET .../analyses/tags` and passed in as `availableTags`,
 * then unioned with the tags on the loaded rows so a tag added by an upload
 * in this session appears in the filter right away.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnalysisCard } from "./analysis-card";
import { AnalysisUpload } from "./analysis-upload";
import { listAnalysesAction } from "./_actions/analyses-actions";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Types ----

type Member = {
  id: string;
  name?: string;
  email?: string;
};

type Props = {
  projectId: string;
  initialAnalyses: ProjectAnalysis[];
  initialTotal: number;
  /** The project's whole tag vocabulary, from GET .../analyses/tags. */
  availableTags: string[];
  members: Member[];
};

// ---- Helpers ----

function memberDisplayName(m: Member | undefined): string {
  if (!m) return "";
  return m.name || m.email || "";
}

// ---- Component ----

export function AnalysesPanel({
  projectId,
  initialAnalyses,
  initialTotal,
  availableTags: serverTags,
  members,
}: Props) {
  const t = useTranslations("analyses");

  // ---- List state ----
  const [list, setList] = useState<ProjectAnalysis[]>(initialAnalyses);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const perPage = 24;

  // ---- Search/filter state ----
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const memberMap = useMemo(
    () => new Map<string, Member>(members.map((m) => [m.id, m])),
    [members]
  );

  function resolveUploaderName(uploaderId: string): string {
    return memberDisplayName(memberMap.get(uploaderId)) || t("card.unknownUploader");
  }

  // ---- Debounce search input ----
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // ---- Refresh list when query/tags/page change ----
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await listAnalysesAction(projectId, {
        q: debouncedQuery || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        perPage,
      });

      if (cancelled) return;

      if (result.ok) {
        setList(result.data.items);
        setTotal(result.data.total);
      } else {
        toast.error(t("toast.listLoadError"));
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, debouncedQuery, selectedTags, page]);

  // ---- Available tags ----
  // The project's full vocabulary comes from the server, unioned with tags on
  // the loaded rows so a tag introduced by an upload in this session shows up
  // in the filter immediately, without waiting for a page refresh.
  const availableTags = useMemo(() => {
    const set = new Set<string>(serverTags);
    for (const a of list) for (const tag of a.tags) set.add(tag);
    return Array.from(set).sort();
  }, [serverTags, list]);

  // ---- Handlers ----

  function handleUploaded(analysis: ProjectAnalysis) {
    setList((prev) => [analysis, ...prev]);
    setTotal((prev) => prev + 1);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      {/* Toolbar — one calm row: search, tag filter, count, upload. The page
          title lives in the Topbar (analyses is a TOPBAR_KEYS page, like
          documents). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[280px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder={t("search.placeholder")}
            className="pl-8"
          />
        </div>

        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedTags([]);
                setPage(1);
              }}
              data-active={selectedTags.length === 0}
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
                data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground
                data-[active=false]:bg-transparent data-[active=false]:text-muted-foreground
                hover:bg-accent hover:text-accent-foreground"
            >
              {t("filter.allTags")}
            </button>
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
                onClick={() => {
                  setSelectedTags([]);
                  setPage(1);
                }}
                className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                {t("filter.clearTags")}
              </button>
            )}
          </div>
        )}

        <div className="ms-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("toolbar.count", { count: total })}
          </span>
          <AnalysisUpload projectId={projectId} onUploaded={handleUploaded} />
        </div>
      </div>

      {/* Grid / empty state */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((analysis) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              projectId={projectId}
              uploaderName={resolveUploaderName(analysis.uploader_id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t("pagination.prev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
