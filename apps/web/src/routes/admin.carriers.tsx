import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { type Carrier } from "@sadiyakargo/shared";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { CarrierFormDialog } from "@/components/CarrierFormDialog";
import { carriersApi } from "@/lib/api/carriers";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requirePermission } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export const Route = createFileRoute("/admin/carriers")({
  beforeLoad: requirePermission("carriers:write"),
  component: CarriersPage,
});

function CarriersPage() {
  const canDelete = useAuthStore((s) => !!s.user?.role.permissions.includes("carriers:delete"));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
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
    {
      key: "phone",
      header: t("admin:col_phone"),
      cell: (c) => (
        <div className="leading-tight">
          <div className="tabular-nums">{c.phone}</div>
          {c.telegramUsername && (
            <a
              href={`https://t.me/${c.telegramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              @{c.telegramUsername}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "addr",
      header: t("admin:col_addressTr"),
      cell: (c) => c.deliveryAddressTr || "—",
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label={t("edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmId(c.id)}
              aria-label={t("delete")}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
      width: "96px",
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
            renderCard={(c) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{c.phone}</p>
                  {c.telegramUsername && (
                    <a
                      href={`https://t.me/${c.telegramUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 inline-block text-xs text-primary hover:underline"
                    >
                      @{c.telegramUsername}
                    </a>
                  )}
                  {c.deliveryAddressTr && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.deliveryAddressTr}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-start gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(c)}
                    aria-label={t("edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(c.id)}
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            )}
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

      <CarrierFormDialog
        open={dialogOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
        carrier={editing ?? undefined}
      />

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
