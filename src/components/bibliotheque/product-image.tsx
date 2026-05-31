"use client";

/**
 * ProductImage — displays a product photo.
 *
 * Fetches the image bytes from the API as a Blob (the API streams them through
 * rather than exposing a presigned object-store URL, whose host is not
 * browser-reachable). Same approach as invoice attachment previews. Renders a
 * placeholder while loading, when the product has no image, or on error.
 * Fixed aspect ratio prevents layout jitter. The object URL is revoked on
 * unmount / product change.
 */

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { env } from "@/lib/config/env";

interface ProductImageProps {
  /** Product id — used to fetch /bibliotheque/products/<id>/image. */
  productId: string;
  /** Whether the product has a stored image. Skips the fetch when false. */
  hasImage: boolean;
  alt: string;
  className?: string;
}

export function ProductImage({ productId, hasImage, alt, className = "" }: ProductImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasImage) return;
    let revoked = false;
    let objectUrl: string | null = null;

    fetch(`${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}/image`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`image ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setFailed(true);
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId, hasImage]);

  const showPlaceholder = !hasImage || failed || !blobUrl;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[var(--paper-2)] ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      {showPlaceholder ? (
        <div className="flex flex-col items-center gap-2" style={{ color: "var(--muted)" }}>
          <Package size={32} strokeWidth={1.5} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blobUrl!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
