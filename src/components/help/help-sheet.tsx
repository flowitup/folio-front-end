"use client";

/**
 * HelpSheet — the question mark that sits next to the notification bell.
 * Opens a side panel listing every workflow the web app exposes; picking one drills into its
 * steps in place, so the reader never navigates away from the screen they had the question about.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, CircleHelp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadHelpCatalogue, type HelpCatalogue } from "@/content/help";

export function HelpSheet() {
  const t = useTranslations("help");
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [topics, setTopics] = useState<HelpCatalogue>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const returnToId = useRef<string | null>(null);

  // The catalogue is a separate chunk per locale, fetched the first time the panel is opened so
  // the prose stays out of the app shell every route loads.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void loadHelpCatalogue(locale).then((catalogue) => {
      if (!cancelled) setTopics(catalogue);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, locale]);

  const selected = topics.find((topic) => topic.id === selectedId) ?? null;

  // Reset on the way in, not on the way out: the panel stays mounted through its close
  // animation, so clearing on close makes the topic visibly snap back to the index as it slides away.
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) setSelectedId(null);
  }, []);

  // Drilling in and out replaces the panel's content, which a screen reader has no other way to
  // notice; move focus to the control that now makes sense.
  useEffect(() => {
    if (selectedId) backRef.current?.focus();
    else if (returnToId.current) {
      document
        .querySelector<HTMLButtonElement>(
          `[data-testid="help-topic-${returnToId.current}"]`
        )
        ?.focus();
      returnToId.current = null;
    }
  }, [selectedId]);

  const handleBack = useCallback(() => {
    returnToId.current = selectedId;
    setSelectedId(null);
  }, [selectedId]);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button type="button" className="btn btn-quiet" aria-label={t("aria.open")}>
          <CircleHelp size={16} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        closeLabel={t("aria.close")}
        data-testid="help-sheet"
      >
        <SheetHeader
          className="shrink-0 gap-1.5 border-b px-4 py-3 pr-12"
          style={{ borderColor: "var(--border)" }}
        >
          {selected ? (
            <>
              <button
                ref={backRef}
                type="button"
                className="-ml-1 flex w-fit items-center gap-1.5 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
                onClick={handleBack}
              >
                <ArrowLeft size={14} />
                {t("back")}
              </button>
              <SheetTitle className="text-base">{selected.title}</SheetTitle>
              <SheetDescription>{selected.purpose}</SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle className="text-base">{t("title")}</SheetTitle>
              <SheetDescription>{t("subtitle")}</SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <article className="flex flex-col gap-5 px-4 py-4">
              <section className="flex flex-col gap-2">
                <SectionLabel>{t("steps")}</SectionLabel>
                <ol className="flex flex-col gap-2">
                  {selected.steps.map((step, index) => (
                    <li
                      key={`${selected.id}-step-${index}`}
                      className="flex gap-2.5 text-sm leading-relaxed"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ color: "var(--foreground)" }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="flex flex-col gap-1.5">
                <SectionLabel>{t("whoCanDoIt")}</SectionLabel>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                  {selected.whoCanDoIt}
                </p>
              </section>

              {selected.gotchas && selected.gotchas.length > 0 && (
                <section className="flex flex-col gap-1.5">
                  <SectionLabel>{t("gotchas")}</SectionLabel>
                  <ul className="flex flex-col gap-1.5">
                    {selected.gotchas.map((gotcha, index) => (
                      <li
                        key={`${selected.id}-gotcha-${index}`}
                        className="flex gap-2 text-sm leading-relaxed"
                        style={{ color: "var(--foreground)" }}
                      >
                        <span aria-hidden style={{ color: "var(--muted-foreground)" }}>
                          &bull;
                        </span>
                        <span>{gotcha}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          ) : topics.length === 0 ? (
            <p
              className="px-4 py-4 text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("loading")}
            </p>
          ) : (
            <ul className="flex flex-col py-1">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    data-testid={`help-topic-${topic.id}`}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--muted)]"
                    onClick={() => setSelectedId(topic.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {topic.title}
                      </span>
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {topic.purpose}
                      </span>
                    </span>
                    <ChevronRight
                      size={14}
                      className="shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </p>
  );
}
