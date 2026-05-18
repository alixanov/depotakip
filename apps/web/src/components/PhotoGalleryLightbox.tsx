import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Trash2,
} from "lucide-react";
import type { PhotoRef } from "@sadiyakargo/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { lotsApi } from "@/lib/api/lots";

interface PhotoGalleryLightboxProps {
  lotId: string;
  photos: PhotoRef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Photo id to focus on open; defaults to the first photo. */
  initialPhotoId?: string;
  canDelete?: boolean;
  /** When true, shows ◀◀ / ▶▶ move buttons that PATCH the photos array order. */
  canReorder?: boolean;
}

export function PhotoGalleryLightbox({
  lotId,
  photos,
  open,
  onOpenChange,
  initialPhotoId,
  canDelete = false,
  canReorder = false,
}: PhotoGalleryLightboxProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Sync the focused index to the initialPhotoId every time the dialog opens
  // (re-opens reuse the same component instance).
  useEffect(() => {
    if (!open) return;
    const startAt = initialPhotoId
      ? Math.max(
          0,
          photos.findIndex((p) => p.id === initialPhotoId)
        )
      : 0;
    setIndex(startAt);
  }, [open, initialPhotoId, photos]);

  const current = photos[index];

  // Presigned URL is short-lived (1h by default). staleTime sits just under so we
  // don't re-request URLs while the user pages through.
  const urlQuery = useQuery({
    enabled: open && !!current,
    queryKey: ["lot-photo-url", lotId, current?.id],
    queryFn: () => lotsApi.getPhotoSignedUrl(lotId, current!.id),
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => lotsApi.removePhoto(lotId, photoId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.removeQueries({ queryKey: ["lot-photo-url", lotId] });
      toast.success(t("photo:toast_deleted"));
      if (updated.photos.length === 0) {
        onOpenChange(false);
      } else if (index >= updated.photos.length) {
        setIndex(updated.photos.length - 1);
      }
    },
    onError: (err) =>
      toast.error(t("photo:toast_delete_failed"), {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  // Reorder swaps the current photo with its neighbour and PATCHes the new
  // full id list. After success we follow the moved photo to keep focus on it.
  const reorderMutation = useMutation({
    mutationFn: (newIds: string[]) => lotsApi.reorderPhotos(lotId, newIds),
    onSuccess: (updated, vars) => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      const movedId = photos[index]?.id;
      const nextIdx = movedId ? updated.photos.findIndex((p) => p.id === movedId) : -1;
      // The id list we sent is authoritative — use it to position the cursor
      // even before the parent re-renders with the new photos prop.
      const fallback = vars.indexOf(movedId ?? "");
      setIndex(Math.max(0, nextIdx >= 0 ? nextIdx : fallback));
    },
    onError: (err) =>
      toast.error(t("photo:reorder_failed"), {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const moveBy = (delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = photos.map((p) => p.id);
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next);
  };

  // Index manipulation is inlined into the keydown handler so the effect can
  // depend only on photos.length — extracting goPrev/goNext as separate fns
  // would have ESLint flagging them as missing deps on every render.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % photos.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIndex((i) => (i + 1) % photos.length);

  if (!current) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl gap-2 p-4">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-black">
            {urlQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin text-white" />}
            {urlQuery.isError && (
              <span className="text-sm text-white">{t("photo:url_failed")}</span>
            )}
            {urlQuery.data && (
              <img
                src={urlQuery.data.url}
                alt={current.id}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            )}

            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  onClick={goPrev}
                  aria-label={t("photo:prev")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  onClick={goNext}
                  aria-label={t("photo:next")}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-1 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {index + 1} / {photos.length}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {Math.round(current.sizeBytes / 1024)} KB
              {current.width && current.height && ` · ${current.width}×${current.height}`}
            </span>
            <div className="flex items-center gap-1">
              {canReorder && photos.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveBy(-1)}
                    disabled={index === 0 || reorderMutation.isPending}
                    aria-label={t("photo:move_left")}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveBy(1)}
                    disabled={index === photos.length - 1 || reorderMutation.isPending}
                    aria-label={t("photo:move_right")}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                  {t("photo:delete")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("photo:delete_title")}
        description={t("photo:delete_desc")}
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(current.id, {
            onSettled: () => setConfirmDeleteOpen(false),
          });
        }}
      />
    </>
  );
}
