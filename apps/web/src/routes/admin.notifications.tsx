import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LANGUAGES,
  NOTIFICATION_TEMPLATE_KEYS,
  createTemplateSchema,
  type CreateTemplateInput,
} from "@depotakip/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { FieldError, FormError } from "@/components/ui/form-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";
import { notificationsApi, type LogRow, type TemplateRow } from "@/lib/api/notifications";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { NotificationTemplateKey } from "@depotakip/shared";

const TEMPLATE_KEY_PREFIX = "admin:tpl_key_";

function templateLabel(t: (k: string) => string, key: NotificationTemplateKey): string {
  const localized = t(`${TEMPLATE_KEY_PREFIX}${key}`);
  // i18next returns the key itself if not found — fall back to the raw key.
  return localized === `${TEMPLATE_KEY_PREFIX}${key}` ? key : localized;
}

export const Route = createFileRoute("/admin/notifications")({
  beforeLoad: requireRole("admin"),
  component: NotificationsPage,
});

type Tab = "templates" | "log";

function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const { t } = useTranslation();
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="templates">{t("admin:tab_templates")}</TabsTrigger>
        <TabsTrigger value="log">{t("admin:tab_logs")}</TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <TemplatesTab />
      </TabsContent>
      <TabsContent value="log">
        <LogsTab />
      </TabsContent>
    </Tabs>
  );
}

function TemplatesTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["notif-templates"],
    queryFn: notificationsApi.templates.list,
  });

  // Optimistic template active toggle.
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      notificationsApi.templates.update(id, { active }),
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ["notif-templates"] });
      const previous = qc.getQueryData<TemplateRow[]>(["notif-templates"]);
      qc.setQueryData<TemplateRow[]>(["notif-templates"], (old) =>
        old?.map((row) => (row.id === id ? { ...row, active } : row))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["notif-templates"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notif-templates"] }),
  });

  const deleteWithUndo = useUndoableDelete({
    queryKey: ["notif-templates"],
    deleteFn: (id) => notificationsApi.templates.remove(id),
    toastTitle: t("admin:tab_templates") + " — " + t("delete"),
  });

  const columns: Column<TemplateRow>[] = [
    {
      key: "key",
      header: t("admin:tpl_key"),
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="text-xs">{templateLabel(t, row.key)}</span>
          <code className="text-[10px] text-muted-foreground">{row.key}</code>
        </span>
      ),
    },
    { key: "ch", header: t("admin:tpl_channel"), cell: (row) => row.channel, width: "80px" },
    { key: "lang", header: t("admin:tpl_lang"), cell: (row) => row.language, width: "60px" },
    {
      key: "body",
      header: t("admin:tpl_body"),
      cell: (row) => <span className="text-xs">{row.body.slice(0, 80)}…</span>,
    },
    {
      key: "active",
      header: t("admin:col_status"),
      width: "80px",
      cell: (row) => (
        <button
          type="button"
          onClick={() => toggleActive.mutate({ id: row.id, active: !row.active })}
          className={
            row.active
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
              : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600"
          }
        >
          {row.active ? t("admin:active") : t("admin:inactive")}
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      className: "text-right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmId(row.id)}
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t("admin:btn_new_template")}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={<Bell />}
                title={t("admin:no_templates_yet")}
                action={
                  <Button onClick={() => setDialogOpen(true)} variant="brand" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin:btn_new_template")}
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      {dialogOpen && <CreateTemplateDialog open onClose={() => setDialogOpen(false)} />}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("admin:tpl_delete_title")}
        destructive
        onConfirm={() => {
          if (confirmId) {
            deleteWithUndo(confirmId);
            setConfirmId(null);
          }
        }}
      />
    </div>
  );
}

function CreateTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      key: "shipment_yolda",
      channel: "telegram",
      language: "tr",
      body: "",
      active: true,
    },
  });
  const handleApiError = useApiFormErrors(form);
  const create = useMutation({
    mutationFn: (data: CreateTemplateInput) => notificationsApi.templates.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-templates"] });
      onClose();
    },
    onError: (err) => setError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:tpl_dialog_title")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setError("");
            create.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{error}</FormError>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:tpl_key")}</Label>
              <select
                {...form.register("key")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {NOTIFICATION_TEMPLATE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {templateLabel(t, k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:tpl_channel")}</Label>
              <select
                {...form.register("channel")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {NOTIFICATION_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:tpl_lang")}</Label>
              <select
                {...form.register("language")}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {NOTIFICATION_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              {t("admin:tpl_body")}{" "}
              <span className="text-[11px] text-muted-foreground">
                {t("admin:tpl_body_help", { vars: "{{shortCode}}, {{trackingUrl}}, {{amount}}" })}
              </span>
            </Label>
            <textarea
              {...form.register("body")}
              rows={4}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
            <FieldError>{form.formState.errors.body?.message}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={create.isPending}>
            {t("save")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"queued" | "sent" | "failed" | "">("");
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["notif-logs", { page, statusFilter }],
    queryFn: () => notificationsApi.logs({ page, status: statusFilter || undefined }),
  });

  const columns: Column<LogRow>[] = [
    {
      key: "ts",
      header: t("date"),
      cell: (l) => formatDateTime(l.createdAt),
      width: "160px",
    },
    {
      key: "key",
      header: t("admin:log_col_template"),
      cell: (l) => <code className="text-xs">{templateLabel(t, l.templateKey)}</code>,
    },
    { key: "ch", header: t("admin:log_col_channel"), cell: (l) => l.channel, width: "80px" },
    {
      key: "to",
      header: t("admin:log_col_recipient"),
      cell: (l) => l.recipientType,
      width: "100px",
    },
    {
      key: "text",
      header: t("admin:log_col_text"),
      cell: (l) => <span className="text-xs">{l.renderedText.slice(0, 80)}</span>,
    },
    {
      key: "status",
      header: t("admin:col_status"),
      width: "100px",
      cell: (l) => (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            l.status === "sent" && "bg-emerald-100 text-emerald-700",
            l.status === "queued" && "bg-slate-100 text-slate-700",
            l.status === "failed" && "bg-rose-100 text-rose-700"
          )}
        >
          {l.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "queued" | "sent" | "failed" | "");
            setPage(1);
          }}
          className="h-11 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{t("admin:log_filter_all_status")}</option>
          <option value="queued">queued</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
        </select>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data?.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(l) => l.id}
            empty={<EmptyState icon={<Bell />} title={t("admin:no_logs_yet")} />}
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
