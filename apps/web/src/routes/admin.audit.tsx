import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, PaginationBar, type Column } from "@/components/ui/data-table";
import { auditApi, type AuditEntry } from "@/lib/api/audit";
import { requirePermission } from "@/lib/guards";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: requirePermission("audit:read"),
  component: AuditPage,
});

const ENTITY_TYPES = [
  "auth",
  "users",
  "senders",
  "carriers",
  "lots",
  "shipments",
  "transactions",
  "exchange-rates",
  "notifications",
];

const ACTIONS = ["create", "update", "delete", "login", "logout", "status_change", "export"];

function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["audit", { page, entityType, action }],
    queryFn: () =>
      auditApi.list({
        page,
        limit: 30,
        entityType: entityType || undefined,
        action: action || undefined,
      }),
  });

  const columns: Column<AuditEntry>[] = [
    {
      key: "at",
      header: t("date"),
      cell: (r) => formatDateTime(r.at),
      width: "160px",
    },
    {
      key: "action",
      header: t("admin:audit_col_action"),
      cell: (r) => t(`admin:audit_action_${r.action}`, { defaultValue: r.action }),
      width: "120px",
    },
    {
      key: "entity",
      header: t("admin:audit_col_entity"),
      cell: (r) => {
        const localized = t(`admin:audit_entity_${r.entityType}`, {
          defaultValue: r.entityType,
        });
        return (
          <span>
            {localized}
            {r.entityId && <code className="ml-1 text-[11px]">/{r.entityId.slice(-6)}</code>}
          </span>
        );
      },
    },
    {
      key: "user",
      header: t("admin:audit_col_user"),
      cell: (r) => {
        if (!r.userId) return "—";
        return (
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{r.userFullName ?? r.userId.slice(-6)}</span>
            {r.userEmail && (
              <span className="text-[10px] text-muted-foreground">{r.userEmail}</span>
            )}
          </span>
        );
      },
      width: "180px",
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      className: "text-right",
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
          Diff
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-md border bg-background px-2 text-sm"
          aria-label={t("admin:audit_col_entity")}
        >
          <option value="">{t("admin:audit_filter_all_entities")}</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-md border bg-background px-2 text-sm"
          aria-label={t("admin:audit_col_action")}
        >
          <option value="">{t("admin:audit_filter_all_actions")}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data?.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(r) => r.id}
            renderCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">
                        {t(`admin:audit_action_${r.action}`, { defaultValue: r.action })}
                      </span>
                      <span className="text-muted-foreground">
                        {t(`admin:audit_entity_${r.entityType}`, { defaultValue: r.entityType })}
                      </span>
                      {r.entityId && (
                        <code className="text-[10px] text-muted-foreground">
                          /{r.entityId.slice(-6)}
                        </code>
                      )}
                    </div>
                    {r.userId && (
                      <p className="mt-0.5 text-xs">
                        <span className="font-medium">{r.userFullName ?? r.userId.slice(-6)}</span>
                        {r.userEmail && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {r.userEmail}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(r.at)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                    Diff
                  </Button>
                </div>
              </div>
            )}
            empty={t("empty")}
          />
          <PaginationBar pagination={query.data?.pagination} onChange={setPage} />
        </CardContent>
      </Card>

      {selected && (
        <Dialog open onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selected.action} · {selected.entityType}
              </DialogTitle>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(selected.diff, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
