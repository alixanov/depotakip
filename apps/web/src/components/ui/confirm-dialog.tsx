import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  /**
   * When set, the confirm button stays disabled until the user types this
   * value exactly. Use for irreversible operations (deleting a user, cancelling
   * a shipped delivery) — prevents accidental clicks.
   */
  requireType?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  requireType,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");

  // Reset the typed value every time the dialog opens so previous attempts
  // don't pre-arm a destructive click.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matches = !requireType || typed === requireType;
  const confirmDisabled = pending || !matches;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {requireType && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-type">
              {t("confirm:type_to_confirm", { value: requireType })}
            </Label>
            <Input
              id="confirm-type"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              aria-invalid={!matches && typed.length > 0}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {pending ? "..." : (confirmLabel ?? t("confirm"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
