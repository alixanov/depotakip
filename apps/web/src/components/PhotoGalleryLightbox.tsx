import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
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
}

export function PhotoGalleryLightbox({
  lotId,
  photos,
  open,
  onOpenChange,
  initialPhotoId,
  canDelete = false,
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

  // Presigned URL is short-lived (TZ §9: 1h). staleTime sits just under so we
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

  const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIndex((i) => (i + 1) % photos.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // photos.length is the only thing goPrev/goNext close over that changes.
  }, [open, photos.length]);

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
            <span className="truncate text-xs text-muted-foreground">
              {Math.round(current.sizeBytes / 1024)} KB
              {current.width && current.height && ` · ${current.width}×${current.height}`}
            </span>
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
