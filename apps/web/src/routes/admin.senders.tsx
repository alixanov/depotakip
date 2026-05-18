import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { type Sender } from "@sadiyakargo/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { SenderFormDialog } from "@/components/SenderFormDialog";
import { sendersApi } from "@/lib/api/senders";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export const Route = createFileRoute("/admin/senders")({
  beforeLoad: requireRole("admin", "operator"),
  component: SendersPage,
});

function SendersPage() {
  const canDelete = useAuthStore((s) => !!s.user?.role.permissions.includes("senders:delete"));
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
        canDelete ? (
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
            renderCard={(s) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{s.fullName}</p>
                    {s.isSelf && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {t("admin:type_self")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{s.phone}</p>
                  {s.address && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.address}</p>
                  )}
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmId(s.id)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            )}
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

      <SenderFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

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
