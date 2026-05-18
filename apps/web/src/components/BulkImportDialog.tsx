import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Download, FileUp, RotateCw, Upload } from "lucide-react";
import { toast } from "sonner";
import type { BulkImportReport } from "@sadiyakargo/shared";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { localizedMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Куда отправлять файл (с указанием entity). */
  importFn: (file: File, onDuplicate: "skip" | "update") => Promise<BulkImportReport>;
  /** URL для скачивания XLSX-шаблона. */
  templateUrl: string;
  /** Какой query-key инвалидировать после успеха (senders/carriers). */
  invalidateKey: string;
  /** Локализованный заголовок диалога (e.g. "Импорт отправителей"). */
  title: string;
}

/**
 * Универсальный bulk-import dialog для senders/carriers. Принимает CSV или
 * XLSX, шлёт на бэкенд, после success показывает отчёт (created/updated/
 * skipped/failed). При наличии failed-строк операторcан их разглядеть и
 * исправить файл, не теряя успешно импортированные.
 */
export function BulkImportDialog({
  open,
  onOpenChange,
  importFn,
  templateUrl,
  invalidateKey,
  title,
}: BulkImportDialogProps) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<BulkImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state при каждом открытии — пред. отчёт не должен «висеть»
  // на новой попытке.
  useEffect(() => {
    if (open) {
      setFile(null);
      setReport(null);
      setOnDuplicate("skip");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => importFn(file!, onDuplicate),
    onSuccess: (data) => {
      setReport(data);
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      const hasFailures = data.failed.length > 0;
      const created = data.created + data.updated;
      if (created > 0 && !hasFailures) {
        toast.success(t("import:toast_success", { count: created }));
      } else if (created > 0 && hasFailures) {
        toast.warning(t("import:toast_partial", { ok: created, failed: data.failed.length }));
      } else {
        toast.error(t("import:toast_nothing"));
      }
    },
    onError: (err) => {
      toast.error(localizedMessage(err, t));
    },
  });

  const downloadTemplate = async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(templateUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = templateUrl.split("/").pop() || "template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t("import:template_failed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {!report && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{t("import:hint_format")}</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" />
                {t("import:download_template")}
              </Button>
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-sm transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
                file && "border-primary/60 bg-primary-soft/40"
              )}
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              {file ? (
                <span className="text-foreground">
                  <span className="font-semibold">{file.name}</span>{" "}
                  <span className="text-muted-foreground">({Math.round(file.size / 1024)} KB)</span>
                </span>
              ) : (
                <>
                  <span className="text-muted-foreground">{t("import:dropzone_hint")}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("import:dropzone_limits")}
                  </span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              />
            </label>

            <div className="space-y-2">
              <Label>{t("import:on_duplicate_label")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOnDuplicate("skip")}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    onDuplicate === "skip"
                      ? "border-primary bg-primary-soft text-primary-soft-foreground"
                      : "border-input bg-background hover:border-foreground/30"
                  )}
                >
                  <p className="text-sm font-semibold">{t("import:dup_skip")}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("import:dup_skip_hint")}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setOnDuplicate("update")}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    onDuplicate === "update"
                      ? "border-primary bg-primary-soft text-primary-soft-foreground"
                      : "border-input bg-background hover:border-foreground/30"
                  )}
                >
                  <p className="text-sm font-semibold">{t("import:dup_update")}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("import:dup_update_hint")}
                  </p>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="brand"
                disabled={!file || mutation.isPending}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <Upload className="h-4 w-4" />
                {t("import:submit")}
              </Button>
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label={t("import:stat_total")} value={report.total} tone="muted" />
              <Stat label={t("import:stat_created")} value={report.created} tone="success" />
              <Stat label={t("import:stat_updated")} value={report.updated} tone="info" />
              <Stat
                label={t("import:stat_skipped")}
                value={report.skippedDuplicates}
                tone="warning"
              />
            </div>

            {report.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {t("import:failed_title", { count: report.failed.length })}
                </div>
                <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-xs">
                  {report.failed.map((f) => {
                    // Display priority: zod-issues (если есть) → translate
                    // каждое отдельно с validation:* префиксом; иначе t(code,
                    // params); иначе сырой reason c backend.
                    let text: string;
                    if (f.issues && f.issues.length > 0) {
                      text = f.issues
                        .map((iss) => {
                          const msg = iss.message.startsWith("validation:")
                            ? t(iss.message)
                            : iss.message;
                          return `${iss.path}: ${msg}`;
                        })
                        .join("; ");
                    } else if (f.code) {
                      const translated = t(f.code, f.params);
                      text = translated !== f.code ? translated : f.reason;
                    } else {
                      text = f.reason;
                    }
                    return (
                      <li key={f.row} className="flex gap-2 p-2">
                        <span className="shrink-0 font-mono font-semibold text-muted-foreground">
                          #{f.row}
                        </span>
                        <span className="text-foreground/90">{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {report.failed.length === 0 && report.created + report.updated > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {t("import:all_ok")}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReport(null)}>
                <RotateCw className="h-3.5 w-3.5" />
                {t("import:another")}
              </Button>
              <Button variant="brand" onClick={() => onOpenChange(false)}>
                {t("import:close")}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "info" | "warning";
}) {
  const toneClass: Record<typeof tone, string> = {
    muted: "bg-muted text-foreground",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  };
  return (
    <div className={cn("rounded-md p-2", toneClass[tone])}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  );
}
