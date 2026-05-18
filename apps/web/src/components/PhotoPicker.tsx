import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-2">
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

      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((p, idx) => (
            <li
              key={`${p.file.name}-${idx}`}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              <img
                src={p.url}
                alt={p.file.name}
                className="h-full w-full object-cover"
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
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 py-0.5 text-[10px] text-white">
                {p.file.name}
              </span>
            </li>
          ))}
        </ul>
      )}
      {value.length === 0 && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          {t("photo:empty_hint")}
        </p>
      )}
    </div>
  );
}
