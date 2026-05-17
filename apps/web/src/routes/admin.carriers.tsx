import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createCarrierSchema, type Carrier, type CreateCarrierInput } from "@sadiyakargo/shared";
import { Plus, Trash2, Truck } from "lucide-react";
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
import { carriersApi } from "@/lib/api/carriers";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export const Route = createFileRoute("/admin/carriers")({
  beforeLoad: requireRole("admin", "operator"),
  component: CarriersPage,
});

function CarriersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useQuery({
    queryKey: ["carriers", page, debouncedSearch],
    queryFn: () => carriersApi.list({ page, limit: 20, q: debouncedSearch || undefined }),
  });

  const deleteWithUndo = useUndoableDelete({
    queryKey: ["carriers"],
    deleteFn: (id) => carriersApi.remove(id),
    toastTitle: t("admin:carriers_title") + " — " + t("delete"),
  });

  const columns: Column<Carrier>[] = [
    {
      key: "name",
      header: t("admin:col_name"),
      cell: (c) => (
        <span className="font-medium">
          {c.firstName} {c.lastName}
        </span>
      ),
    },
    { key: "phone", header: t("admin:col_phone"), cell: (c) => c.phone },
    {
      key: "addr",
      header: t("admin:col_addressTr"),
      cell: (c) => c.deliveryAddressTr || "—",
    },
    {
      key: "actions",
      header: "",
      cell: (c) =>
        role === "admin" ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmId(c.id)}
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
        <h2 className="text-lg font-bold">{t("admin:carriers_title")}</h2>
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
            rowKey={(c) => c.id}
            empty={
              <EmptyState
                icon={<Truck />}
                title={t("admin:no_carriers_yet")}
                action={
                  <Button onClick={() => setDialogOpen(true)} variant="brand" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin:btn_new_carrier")}
                  </Button>
                }
              />
            }
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>

      <CreateCarrierDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("delete") + " — " + t("admin:carriers_title")}
        description={t("admin:delete_carrier_desc")}
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

function CreateCarrierDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateCarrierInput>({
    resolver: zodResolver(createCarrierSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      deliveryAddressTr: "",
      notes: "",
    },
  });
  const handleApiError = useApiFormErrors(form);

  const create = useMutation({
    mutationFn: (data: CreateCarrierInput) => carriersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carriers"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_carrier")}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            create.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:col_first_name")}</Label>
              <Input {...form.register("firstName")} autoFocus autoComplete="given-name" />
              <FieldError>{form.formState.errors.firstName?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:col_last_name")}</Label>
              <Input {...form.register("lastName")} autoComplete="family-name" />
              <FieldError>{form.formState.errors.lastName?.message}</FieldError>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_phone")}</Label>
            <Input {...form.register("phone")} placeholder="+90..." autoComplete="tel" />
            <FieldError>{form.formState.errors.phone?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_addr_delivery")}</Label>
            <Input {...form.register("deliveryAddressTr")} autoComplete="street-address" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_notes")}</Label>
            <Input {...form.register("notes")} />
          </div>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
