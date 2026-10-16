"use client";

/**
 * Shown when the notes could not be loaded (5xx, timeout). It used to render
 * as an empty notebook, which reads as "the notes were deleted" and invites
 * typing them again.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

export function NotesLoadError() {
  const t = useTranslations("notes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="notes-wrap wide">
      <div className="empty-state" role="alert">
        <div className="empty-glyph"><AlertTriangle size={26} /></div>
        <h3 className="font-display">{t("loadError.title")}</h3>
        <p>{t("loadError.body")}</p>
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RotateCw size={14} /> {t("loadError.retry")}
        </button>
      </div>
    </div>
  );
}
