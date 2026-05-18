import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { lotsApi } from "@/lib/api/lots";
import { cn } from "@/lib/utils";

interface PhotoThumbProps {
  lotId: string;
  photoId: string | null;
  /** Square size in px. Default 48. */
  size?: number;
  className?: string;
  /** Optional click handler — useful for opening the lightbox. */
  onClick?: () => void;
}

/**
 * Square thumbnail backed by a 1h-presigned URL (TZ §9 photo-storage rule).
 * useQuery caches per (lotId, photoId) for 50min so re-renders and sibling
 * rows reuse the same URL — N rows = N requests, not N×renders.
 *
 * If `photoId` is null (lot has no photos), shows a muted placeholder.
 */
export function PhotoThumb({ lotId, photoId, size = 48, className, onClick }: PhotoThumbProps) {
  const urlQuery = useQuery({
    enabled: !!photoId,
    queryKey: ["lot-photo-url", lotId, photoId],
    queryFn: () => lotsApi.getPhotoSignedUrl(lotId, photoId!),
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dim = { width: size, height: size };
  const baseClass = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
    onClick && "cursor-pointer transition-opacity hover:opacity-80",
    className
  );

  if (!photoId) {
    return (
      <div className={baseClass} style={dim} aria-label="no photo">
        <ImageOff className="h-4 w-4 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass} style={dim} disabled={!onClick}>
      {urlQuery.data ? (
        <img
          src={urlQuery.data.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="h-full w-full animate-pulse bg-muted-foreground/10" />
      )}
    </button>
  );
}
