"use client";

/**
 * ProductImage — displays a product photo from a presigned URL.
 *
 * Uses a presigned object-storage URL (fetched server-side via
 * fetchProductImageUrl). When has_image is false or the URL fails to load,
 * renders a placeholder box. Fixed aspect ratio to prevent layout jitter.
 */

import { useState } from "react";
import { Package } from "lucide-react";

interface ProductImageProps {
  /** Presigned URL from the product image endpoint. Null = no image. */
  src: string | null;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = "" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const showPlaceholder = !src || failed;

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
          src={src!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
