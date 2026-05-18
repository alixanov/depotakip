import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";
import { cn } from "@/lib/utils";

interface PhotoPickerProps {
  value: File[];
  onChange: (files: File[]) => void;
  maxCount: number;
  /** Per-file size cap in bytes. */
  maxBytes: number;
  disabled?: boolean;
}

interface Preview {
  file: File;
  url: string;
}

/** Staged-files picker used inside forms. Files are kept in component state
 *  until the parent submits them — see ReceiveTab.submit() in depo.tsx. */
export function PhotoPicker({ value, onChange, maxCount, maxBytes, disabled }: PhotoPickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  // HTML5 drag-and-drop reorder state. Touch devices don't fire HTML5 dnd
  // events — that's a known limitation; touch users can still re-add files in
  // the desired order.
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Re-build object URLs whenever `value` changes; revoke the previous batch
  // so they don't leak memory across renders.
  useEffect(() => {
    const next = value.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => {
      for (const p of next) URL.revokeObjectURL(p.url);
    };
  }, [value]);

  const remaining = maxCount - value.length;

  const ingest = (incoming: File[]) => {
    if (disabled) return;
    const filtered: File[] = [];
    let skippedSize = 0;
    let skippedNonImage = 0;
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) {
        skippedNonImage += 1;
        continue;
      }
      if (f.size > maxBytes) {
        skippedSize += 1;
        continue;
      }
      filtered.push(f);
    }
    if (skippedNonImage > 0) {
      toast.warning(t("photo:skip_non_image", { count: skippedNonImage }));
    }
    if (skippedSize > 0) {
      toast.warning(
        t("photo:skip_too_large", {
          count: skippedSize,
          mb: Math.round(maxBytes / (1024 * 1024)),
        })
      );
    }
    const overflow = Math.max(0, filtered.length - remaining);
    if (overflow > 0) {
      toast.warning(t("photo:skip_overflow", { count: overflow, max: maxCount }));
    }
    const accepted = filtered.slice(0, remaining);
    if (accepted.length > 0) onChange([...value, ...accepted]);
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= value.length || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            ingest(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-muted-foreground">{t("photo:dropzone_hint")}</span>
          <span className="text-[11px] text-muted-foreground">
            {t("photo:dropzone_limits", {
              remaining,
              max: maxCount,
              mb: Math.round(maxBytes / (1024 * 1024)),
            })}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || remaining <= 0}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              ingest(files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>

        {/* Camera capture — opens a getUserMedia dialog. Disabled when the
         *  upload limit is reached so we don't surprise the operator with an
         *  immediate "skip overflow" toast right after they take a shot. */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setCameraOpen(true)}
          disabled={disabled || remaining <= 0}
          className="h-28 flex-col gap-1 px-4 sm:w-32"
          aria-label={t("photo:camera_open")}
        >
          <Camera className="h-5 w-5" />
          <span className="text-xs font-semibold">{t("photo:camera_short")}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {t("photo:camera_open")}
          </span>
        </Button>
      </div>

      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((p, idx) => (
            <li
              key={`${p.file.name}-${idx}`}
              draggable={!disabled}
              onDragStart={(e) => {
                if (disabled) return;
                setDraggedIdx(idx);
                e.dataTransfer.effectAllowed = "move";
                // Some browsers refuse to start the drag without data set.
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e) => {
                if (disabled || draggedIdx === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hoverIdx !== idx) setHoverIdx(idx);
              }}
              onDragLeave={() => {
                if (hoverIdx === idx) setHoverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null) reorder(draggedIdx, idx);
                setDraggedIdx(null);
                setHoverIdx(null);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setHoverIdx(null);
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-md border bg-muted transition-all",
                !disabled && "cursor-move",
                draggedIdx === idx && "opacity-40",
                hoverIdx === idx && draggedIdx !== null && draggedIdx !== idx
                  ? "ring-2 ring-primary"
                  : ""
              )}
            >
              <img
                src={p.url}
                alt={p.file.name}
                className="pointer-events-none h-full w-full object-cover"
                draggable={false}
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => removeAt(idx)}
                aria-label={t("photo:remove_staged")}
              >
                <X className="h-3 w-3" />
              </Button>
              <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                {idx + 1}
              </span>
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 py-0.5 text-[10px] text-white">
                {p.file.name}
              </span>
            </li>
          ))}
        </ul>
      )}
      {value.length > 1 && (
        <p className="text-[11px] text-muted-foreground">{t("photo:reorder_hint")}</p>
      )}
      {value.length === 0 && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          {t("photo:empty_hint")}
        </p>
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          // Reuse the same size/count/MIME validation pipeline as drag-drop.
          ingest([file]);
        }}
      />
    </div>
  );
}
