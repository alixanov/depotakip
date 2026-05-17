import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createSenderSchema, type CreateSenderInput, type Sender } from "@sadiyakargo/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { FieldError, FormError } from "@/components/ui/form-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { sendersApi } from "@/lib/api/senders";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export const Route = createFileRoute("/admin/senders")({
  beforeLoad: requireRole("admin", "operator"),
  component: SendersPage,
});

function SendersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useQuery({
    queryKey: ["senders", page, debouncedSearch],
    queryFn: () => sendersApi.list({ page, limit: 20, q: debouncedSearch || undefined }),
  });

  const deleteWithUndo = useUndoableDelete({
    queryKey: ["senders"],
    deleteFn: (id) => sendersApi.remove(id),
    toastTitle: t("admin:senders_title") + " — " + t("delete"),
  });

  const columns: Column<Sender>[] = [
    {
      key: "name",
      header: t("admin:col_name"),
      cell: (s) => <span className="font-medium">{s.fullName}</span>,
    },
    { key: "phone", header: t("admin:col_phone"), cell: (s) => s.phone },
    { key: "address", header: t("admin:col_address"), cell: (s) => s.address || "—" },
    {
      key: "isSelf",
      header: t("admin:col_type"),
      cell: (s) =>
        s.isSelf ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {t("admin:type_self")}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("admin:type_external")}</span>
        ),
      width: "100px",
    },
    {
      key: "actions",
      header: "",
      cell: (s) =>
        role === "admin" ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmId(s.id)}
            aria-label={t("delete")}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null,
      width: "60px",
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("admin:senders_title")}</h2>
        <div className="flex gap-2">
          <Input
            placeholder={t("admin:search_name_phone")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-56"
          />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("add")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data?.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(s) => s.id}
            empty={
              <EmptyState
                icon={<Users />}
                title={t("admin:no_senders_yet")}
                action={
                  <Button onClick={() => setDialogOpen(true)} variant="brand" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin:btn_new_sender")}
                  </Button>
                }
              />
            }
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>

      <CreateSenderDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("delete") + " — " + t("admin:senders_title")}
        description={t("admin:delete_sender_desc")}
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

function CreateSenderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateSenderInput>({
    resolver: zodResolver(createSenderSchema),
    defaultValues: { fullName: "", phone: "", address: "", notes: "", isSelf: false },
  });
  const handleApiError = useApiFormErrors(form);

  const create = useMutation({
    mutationFn: (data: CreateSenderInput) => sendersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["senders"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_sender")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            create.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="space-y-1.5">
            <Label>{t("admin:col_name")}</Label>
            <Input {...form.register("fullName")} autoFocus autoComplete="name" />
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_phone")}</Label>
            <Input {...form.register("phone")} placeholder="+998..." autoComplete="tel" />
            <FieldError>{form.formState.errors.phone?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_address")}</Label>
            <Input {...form.register("address")} autoComplete="street-address" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("isSelf")} />
            {t("admin:isSelf_label")}
          </label>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
