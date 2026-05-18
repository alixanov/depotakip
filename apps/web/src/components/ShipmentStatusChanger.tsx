import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { STATUSES, type Shipment, type Status } from "@sadiyakargo/shared";
import { Button } from "@/components/ui/button";
import { shipmentsApi } from "@/lib/api/shipments";
import { localizedMessage } from "@/lib/errors";
import { useRealtimeStore } from "@/stores/realtime";
import { celebrate } from "@/lib/confetti";
import { cn } from "@/lib/utils";

interface Props {
  shipment: Shipment;
  /** Called after the server confirms; lets the host (sheet/dialog) close itself. */
  onComplete?: () => void;
  /** Cancel handler — closes the chooser without mutating. */
  onCancel?: () => void;
  /** Layout: "inline" for the detail sheet, "dialog" for a modal context. */
  variant?: "inline" | "dialog";
}

/**
 * Reusable status-change UI: chip-grid of every status + comment field +
 * save/cancel. Owns the mutation so it can be dropped into the detail sheet
 * (inline) or the legacy quick-action dialog without duplicating wiring.
 *
 * On success it also primes the realtime flash store so the originating row
 * highlights even when this user (not a teammate) initiated the change.
 */
export function ShipmentStatusChanger({
  shipment,
  onComplete,
  onCancel,
  variant = "inline",
}: Props) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [newStatus, setNewStatus] = useState<Status>(shipment.status);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const flash = useRealtimeStore((s) => s.flash);

  const mutate = useMutation({
    mutationFn: () => shipmentsApi.updateStatus(shipment.id, { status: newStatus, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["shipment", shipment.id] });
      qc.invalidateQueries({ queryKey: ["lots"] });
      flash(shipment.id);
      if (newStatus === "teslim" && shipment.status !== "teslim") celebrate();
      onComplete?.();
    },
    onError: (err) => setError(localizedMessage(err, t)),
  });

  const dirty = newStatus !== shipment.status;

  return (
    <div className={cn("space-y-3", variant === "inline" && "rounded-lg border bg-muted/30 p-3")}>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setNewStatus(s)}
            aria-pressed={newStatus === s}
            className={cn(
              "min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              newStatus === s
                ? "border-primary bg-primary/5 text-primary"
                : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {t(`status:${s}`)}
          </button>
        ))}
      </div>
      <textarea
        placeholder={t("takip:comment_ph")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-md border bg-background p-2 text-sm"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={mutate.isPending}>
            {t("cancel")}
          </Button>
        )}
        <Button
          variant="brand"
          onClick={() => mutate.mutate()}
          loading={mutate.isPending}
          disabled={!dirty}
        >
          {t("takip:submit")}
        </Button>
      </div>
    </div>
  );
}
