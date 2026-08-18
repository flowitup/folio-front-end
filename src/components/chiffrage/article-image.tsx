"use client";

/**
 * ArticleImage — an article's thumbnail, click to enlarge.
 *
 * Bytes come from the API as a Blob rather than a plain <img src>: the store
 * endpoint is not browser-reachable and the app CSP only allows same-origin
 * images, so a supplier CDN URL would be blocked outright. Same approach as
 * bibliothèque product photos and invoice attachment previews.
 *
 * image_ref tells us which endpoint holds the bytes — the article's own photo,
 * or the library product its retained quote points at.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon } from "lucide-react";

import { env } from "@/lib/config/env";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ChiffrageImageRef } from "@/lib/api/chiffrage";

function endpointFor(projectId: string, ref: ChiffrageImageRef): string {
  return ref.kind === "article"
    ? `${env.apiBaseUrl}/projects/${projectId}/chiffrage/articles/${ref.id}/image`
    : `${env.apiBaseUrl}/bibliotheque/products/${ref.id}/image`;
}

interface Props {
  projectId: string;
  imageRef: ChiffrageImageRef | null;
  alt: string;
  /** Bump to force a refetch after an upload or removal. */
  version?: number;
}

export function ArticleImage({ projectId, imageRef, alt, version = 0 }: Props) {
  const t = useTranslations("chiffrage");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // No state reset here: the render below already falls back to the
    // placeholder when imageRef is null, and the cleanup revokes the previous
    // blob — setting state in the effect would just add a render pass.
    if (!imageRef) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(endpointFor(projectId, imageRef), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`image ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, imageRef, version]);

  if (!imageRef || !blobUrl) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted/40"
        data-testid="article-image-placeholder"
        aria-hidden="true"
      >
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-10 shrink-0 overflow-hidden rounded border"
        title={t("viewImage")}
        aria-label={t("viewImage")}
        data-testid="article-image-thumb"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blobUrl} alt={alt} className="h-full w-full object-cover" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={alt}
            className="max-h-[70vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
