import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImageOff } from "lucide-react";
import { lotsApi } from "@/lib/api/lots";
import { cn } from "@/lib/utils";

interface PhotoThumbProps {
  lotId: string;
  photoId: string | null;
  /** Square size in px. Default 48. */
  size?: number;
  className?: string;
  /** When provided, the thumb becomes a button that fires this on click. */
  onClick?: () => void;
}

/**
 * Square thumbnail backed by a 1h-presigned URL (the default photo-storage TTL).
 * useQuery caches per (lotId, photoId) for 50 min so re-renders and sibling
 * rows reuse the same URL — N rows = N requests, not N×renders. `gcTime` is
 * intentionally just under the 1h presign TTL (55 min) so a query that lives
 * past `staleTime` still refetches before the underlying URL expires.
 *
 * Rendering modes:
 *   - photoId null               → non-interactive <div> with empty-state icon
 *   - photoId set + no onClick   → non-interactive <div> with the image
 *   - photoId set + onClick      → <button> wrapping the image (aria-label set)
 */
export function PhotoThumb({ lotId, photoId, size = 48, className, onClick }: PhotoThumbProps) {
  const { t } = useTranslation();
  const urlQuery = useQuery({
    enabled: !!photoId,
    queryKey: ["lot-photo-url", lotId, photoId],
    queryFn: () => lotsApi.getPhotoSignedUrl(lotId, photoId!),
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dim = { width: size, height: size };
  const baseClass = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
    className
  );

  if (!photoId) {
    return (
      <div className={baseClass} style={dim} aria-label={t("photo:no_photo_aria")}>
        <ImageOff className="h-4 w-4 text-muted-foreground/60" />
      </div>
    );
  }

  const content = urlQuery.isError ? (
    <ImageOff className="h-4 w-4 text-destructive/70" aria-hidden="true" />
  ) : urlQuery.data ? (
    <img
      src={urlQuery.data.url}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover"
      draggable={false}
    />
  ) : (
    <span className="h-full w-full animate-pulse bg-muted-foreground/10" aria-hidden="true" />
  );

  if (!onClick) {
    return (
      <div className={baseClass} style={dim} role="img" aria-label={t("photo:thumb_aria")}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseClass, "cursor-pointer transition-opacity hover:opacity-80")}
      style={dim}
      aria-label={t("photo:open_gallery_aria")}
    >
      {content}
    </button>
  );
}
