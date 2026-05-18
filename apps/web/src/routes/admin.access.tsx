import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  createPermissionSchema,
  createRoleSchema,
  PERMISSION_GROUPS,
  type CreatePermissionInput,
  type CreateRoleInput,
  type Permission,
  type Role,
} from "@sadiyakargo/shared";
import {
  Briefcase,
  Eye,
  KeySquare,
  Lock,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldError, FormError } from "@/components/ui/form-error";
import { Tooltip } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { permissionsApi, rolesApi } from "@/lib/api/access";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requirePermission } from "@/lib/guards";
import { ApiError } from "@/lib/api/client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/access")({
  beforeLoad: requirePermission("roles:manage"),
  component: AccessPage,
});

// ────────────────────────────────────────────────────────────────────────────
// Role visual identity. System roles (admin/operator/viewer) get bespoke icons
// + gradient backgrounds; custom roles fall back to the neutral palette.
// ────────────────────────────────────────────────────────────────────────────

interface Palette {
  Icon: typeof Shield;
  ring: string;
  iconBg: string;
  iconFg: string;
  cardAccent: string;
}

const SYSTEM_PALETTES: Record<string, Palette> = {
  admin: {
    Icon: Shield,
    ring: "ring-violet-200/70 dark:ring-violet-500/30",
    iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    iconFg: "text-white",
    cardAccent: "from-violet-500/15 via-transparent to-transparent",
  },
  operator: {
    Icon: Briefcase,
    ring: "ring-sky-200/70 dark:ring-sky-500/30",
    iconBg: "bg-gradient-to-br from-sky-500 to-indigo-500",
    iconFg: "text-white",
    cardAccent: "from-sky-500/15 via-transparent to-transparent",
  },
  viewer: {
    Icon: Eye,
    ring: "ring-emerald-200/70 dark:ring-emerald-500/30",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    iconFg: "text-white",
    cardAccent: "from-emerald-500/15 via-transparent to-transparent",
  },
};

const CUSTOM_PALETTE: Palette = {
  Icon: KeySquare,
  ring: "ring-border",
  iconBg: "bg-muted",
  iconFg: "text-muted-foreground",
  cardAccent: "from-muted/40 via-transparent to-transparent",
};

function paletteFor(role: Role): Palette {
  if (role.isSystem && SYSTEM_PALETTES[role.name]) return SYSTEM_PALETTES[role.name];
  return CUSTOM_PALETTE;
}

function AccessPage() {
  const [tab, setTab] = useState<"roles" | "permissions">("roles");
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <PageHeader title={t("access:roles_title")} subtitle={t("access:admin_locked_hint")} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "roles" | "permissions")}>
        <TabsList>
          <TabsTrigger value="roles">
            <Shield className="h-3.5 w-3.5" />
            {t("access:tab_roles")}
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <KeySquare className="h-3.5 w-3.5" />
            {t("access:tab_permissions")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Roles tab — 1/2/3-column responsive grid of role cards.
// ────────────────────────────────────────────────────────────────────────────

function RolesTab() {
  const { t } = useTranslation();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const qc = useQueryClient();

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success(t("access:toast_role_deleted"));
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("access:toast_role_delete_failed")),
  });

  // System roles first, then alphabetical inside each group.
  const sortedRoles = useMemo(() => {
    if (!rolesQuery.data) return [];
    return [...rolesQuery.data].sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [rolesQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowCreate(true)} variant="brand">
          <Plus className="h-4 w-4" />
          {t("access:new_role")}
        </Button>
      </div>

      {rolesQuery.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      )}

      {!rolesQuery.isLoading && sortedRoles.length === 0 && (
        <Card>
          <EmptyState
            icon={<Shield />}
            title={t("access:roles_empty")}
            action={
              <Button onClick={() => setShowCreate(true)} variant="brand" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t("access:new_role")}
              </Button>
            }
          />
        </Card>
      )}

      {sortedRoles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => setEditingRole(role)}
              onDelete={() => setConfirmDelete(role)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <RoleFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          mode="create"
          onSaved={() => qc.invalidateQueries({ queryKey: ["roles"] })}
        />
      )}
      {editingRole && (
        <RoleFormDialog
          open={!!editingRole}
          onOpenChange={(o) => !o && setEditingRole(null)}
          mode="edit"
          role={editingRole}
          onSaved={() => qc.invalidateQueries({ queryKey: ["roles"] })}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={t("access:delete_role_title")}
        description={
          confirmDelete ? `${confirmDelete.name} — ${t("access:delete_role_desc")}` : null
        }
        destructive
        pending={deleteMutation.isPending}
        requireType={confirmDelete?.name}
        onConfirm={() => {
          if (confirmDelete) {
            deleteMutation.mutate(confirmDelete.id, {
              onSettled: () => setConfirmDelete(null),
            });
          }
        }}
      />
    </div>
  );
}

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const palette = paletteFor(role);
  const { Icon } = palette;
  const inUse = (role.userCount ?? 0) > 0;
  const canDelete = !role.isSystem && !inUse;

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden p-0 ring-1 transition-shadow",
        palette.ring,
        "hover:shadow-soft-lg"
      )}
    >
      {/* Soft accent wash to identify role type at a glance */}
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", palette.cardAccent)}
      />

      <CardContent className="relative flex flex-1 flex-col gap-4 p-5">
        {/* Header: icon + name + system/custom badge */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft",
              palette.iconBg,
              palette.iconFg
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight">{role.name}</p>
            <Badge tone={role.isSystem ? "primary" : "neutral"} size="sm" className="mt-1">
              {role.isSystem ? (
                <>
                  <Lock className="h-2.5 w-2.5" />
                  {t("access:badge_system")}
                </>
              ) : (
                t("access:badge_custom")
              )}
            </Badge>
          </div>
        </div>

        {role.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{role.description}</p>
        )}

        {/* Stat chips: permissions count + users count, both tabular-nums */}
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Stat
            icon={<KeySquare className="h-3.5 w-3.5" />}
            label={t("access:permissions_count", { n: role.permissions.length })}
            tone="primary"
          />
          <Stat
            icon={<UsersIcon className="h-3.5 w-3.5" />}
            label={t("access:users_count", { n: role.userCount ?? 0 })}
            tone={inUse ? "success" : "muted"}
          />
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Pencil className="h-3.5 w-3.5" />
            {role.isSystem ? t("access:open_matrix") : t("edit")}
          </Button>
          {!role.isSystem && (
            <Tooltip content={inUse ? t("access:delete_role_desc") : t("delete")}>
              <span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDelete}
                  disabled={!canDelete}
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "success" | "muted";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary-soft text-primary-soft-foreground"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums",
        toneCls
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Role form dialog with matrix-of-permissions
// ────────────────────────────────────────────────────────────────────────────

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  role?: Role;
  onSaved: () => void;
}

function RoleFormDialog({ open, onOpenChange, mode, role, onSaved }: RoleFormDialogProps) {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 150);
  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionsApi.list(),
  });
  // Lock the admin role's permission matrix — the backend rejects edits too.
  const isLockedAdmin = role?.isSystem && role.name === "admin";
  const isSystem = role?.isSystem ?? false;

  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? [],
    },
  });
  const handleApiError = useApiFormErrors(form);

  const mutation = useMutation({
    mutationFn: (data: CreateRoleInput) =>
      mode === "create" ? rolesApi.create(data) : rolesApi.update(role!.id, data),
    onSuccess: () => {
      toast.success(
        mode === "create" ? t("access:toast_role_created") : t("access:toast_role_updated")
      );
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissionsQuery.data ?? []) {
      const key = p.group ?? "other";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...PERMISSION_GROUPS, "other"]
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [permissionsQuery.data]);

  const filteredGrouped = useMemo(() => {
    if (!debouncedSearch.trim()) return grouped;
    const q = debouncedSearch.trim().toLowerCase();
    return grouped
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (p) => p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [grouped, debouncedSearch]);

  const totalPermissions = permissionsQuery.data?.length ?? 0;
  const HeaderIcon = role ? paletteFor(role).Icon : Plus;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  role
                    ? `${paletteFor(role).iconBg} ${paletteFor(role).iconFg}`
                    : "bg-primary-soft text-primary-soft-foreground"
                )}
              >
                <HeaderIcon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              {mode === "create" ? t("access:new_role") : `${t("edit")} — ${role?.name}`}
            </span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            mutation.mutate(d);
          })}
          className="space-y-4"
        >
          <FormError>{serverError}</FormError>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("access:role_name")}</Label>
              <Input
                {...form.register("name")}
                disabled={isSystem}
                autoFocus={mode === "create"}
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>{t("access:role_description")}</Label>
              <Input {...form.register("description")} />
            </div>
          </div>

          <div className="space-y-2">
            <Controller
              name="permissions"
              control={form.control}
              render={({ field }) => {
                const selected = new Set(field.value);
                const toggle = (key: string) => {
                  if (isLockedAdmin) return;
                  if (selected.has(key)) selected.delete(key);
                  else selected.add(key);
                  field.onChange([...selected]);
                };
                const toggleGroup = (items: Permission[], on: boolean) => {
                  if (isLockedAdmin) return;
                  for (const item of items) {
                    if (on) selected.add(item.key);
                    else selected.delete(item.key);
                  }
                  field.onChange([...selected]);
                };

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="inline-flex items-center gap-1.5">
                        <Settings2 className="h-3.5 w-3.5" />
                        {t("access:permissions_matrix")}
                      </Label>
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {t("access:selected_count", {
                          n: selected.size,
                          total: totalPermissions,
                        })}
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("access:search_perm_ph")}
                        className="pl-9"
                      />
                    </div>

                    <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3">
                      {filteredGrouped.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          {t("notFound")}
                        </p>
                      )}
                      {filteredGrouped.map(({ group, items }) => {
                        const allSelected = items.every((p) => selected.has(p.key));
                        const someSelected = !allSelected && items.some((p) => selected.has(p.key));
                        return (
                          <section key={group} className="rounded-lg bg-card p-3 shadow-soft">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-soft-foreground">
                                {t(`access:group_${group}`, { defaultValue: group })}
                                <span className="ml-1.5 text-muted-foreground">
                                  · {items.filter((p) => selected.has(p.key)).length}/{items.length}
                                </span>
                              </h3>
                              {!isLockedAdmin && (
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(items, !allSelected)}
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors",
                                    "hover:bg-muted hover:text-foreground",
                                    allSelected
                                      ? "text-muted-foreground"
                                      : someSelected
                                        ? "text-primary"
                                        : "text-primary"
                                  )}
                                >
                                  {allSelected
                                    ? t("access:clear_all_group")
                                    : t("access:select_all_group")}
                                </button>
                              )}
                            </div>
                            <ul className="grid gap-1 sm:grid-cols-2">
                              {items.map((p) => {
                                const checked = selected.has(p.key);
                                return (
                                  <li key={p.key}>
                                    <label
                                      className={cn(
                                        "flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 text-sm transition-colors",
                                        checked
                                          ? "border-primary/20 bg-primary-soft/60"
                                          : "hover:border-border hover:bg-muted/50",
                                        isLockedAdmin && "cursor-not-allowed opacity-70"
                                      )}
                                    >
                                      <Checkbox
                                        className="mt-0.5"
                                        checked={checked}
                                        onChange={() => toggle(p.key)}
                                        disabled={isLockedAdmin}
                                      />
                                      <span className="min-w-0">
                                        <span className="block truncate text-xs font-semibold">
                                          {p.label}
                                        </span>
                                        <code className="block truncate text-[10px] text-muted-foreground">
                                          {p.key}
                                        </code>
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </>
                );
              }}
            />
            {isLockedAdmin && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <Lock className="mr-1 inline h-3 w-3" />
                {t("access:admin_locked_hint")}
              </p>
            )}
            {isSystem && !isLockedAdmin && (
              <p className="text-xs text-muted-foreground">{t("access:system_locked_hint")}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={mutation.isPending}
              disabled={isLockedAdmin}
            >
              {mode === "create" ? t("create") : t("save")}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Permissions tab — grouped catalogue, per-group card with system badges
// ────────────────────────────────────────────────────────────────────────────

function PermissionsTab() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Permission | null>(null);
  const qc = useQueryClient();

  const query = useQuery({ queryKey: ["permissions"], queryFn: () => permissionsApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionsApi.remove(id),
    onSuccess: () => {
      toast.success(t("access:toast_perm_deleted"));
      qc.invalidateQueries({ queryKey: ["permissions"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("access:toast_perm_delete_failed")),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of query.data ?? []) {
      const key = p.group ?? "other";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...PERMISSION_GROUPS, "other"]
      .map((g) => ({
        group: g,
        items: (map.get(g) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowCreate(true)} variant="brand">
          <Plus className="h-4 w-4" />
          {t("access:new_permission")}
        </Button>
      </div>

      {query.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {!query.isLoading && (query.data?.length ?? 0) === 0 && (
        <Card>
          <EmptyState
            icon={<KeySquare />}
            title={t("access:permissions_title")}
            action={
              <Button onClick={() => setShowCreate(true)} variant="brand" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t("access:new_permission")}
              </Button>
            }
          />
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {grouped.map(({ group, items }) => (
          <Card key={group} className="overflow-hidden">
            <CardContent className="p-0">
              <header className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-soft-foreground">
                  {t(`access:group_${group}`, { defaultValue: group })}
                </h3>
                <Badge tone="primary" size="sm">
                  {items.length}
                </Badge>
              </header>
              <ul className="divide-y">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                      <KeySquare className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{p.label}</p>
                        {p.isSystem && (
                          <Badge tone="primary" size="sm">
                            <Lock className="h-2.5 w-2.5" />
                            {t("access:badge_system")}
                          </Badge>
                        )}
                      </div>
                      <code className="block truncate text-[11px] text-muted-foreground">
                        {p.key}
                      </code>
                    </div>
                    {!p.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("delete")}
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {showCreate && (
        <PermissionFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={() => qc.invalidateQueries({ queryKey: ["permissions"] })}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={t("access:delete_perm_title")}
        description={
          confirmDelete ? `${confirmDelete.key} — ${t("access:delete_perm_desc")}` : null
        }
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete) {
            deleteMutation.mutate(confirmDelete.id, {
              onSettled: () => setConfirmDelete(null),
            });
          }
        }}
      />
    </div>
  );
}

function PermissionFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState("");
  const form = useForm<CreatePermissionInput>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: { key: "", label: "", description: "", group: undefined },
  });
  const handleApiError = useApiFormErrors(form);
  const mutation = useMutation({
    mutationFn: (data: CreatePermissionInput) => permissionsApi.create(data),
    onSuccess: () => {
      toast.success(t("access:toast_perm_created"));
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <KeySquare className="h-4 w-4" />
              </span>
              {t("access:new_permission")}
            </span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            mutation.mutate(d);
          })}
          className="space-y-3"
        >
          <FormError>{serverError}</FormError>
          <div className="space-y-1.5">
            <Label>{t("access:perm_key")}</Label>
            <Input
              {...form.register("key")}
              placeholder="module:action"
              autoFocus
              className="font-mono"
              aria-invalid={!!form.formState.errors.key}
            />
            <FieldError>{form.formState.errors.key?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("access:perm_label")}</Label>
            <Input {...form.register("label")} aria-invalid={!!form.formState.errors.label} />
            <FieldError>{form.formState.errors.label?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("access:perm_group")}</Label>
            <select
              {...form.register("group")}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft"
            >
              <option value="">—</option>
              {PERMISSION_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`access:group_${g}`, { defaultValue: g })}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("access:perm_description")}</Label>
            <Input {...form.register("description")} />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
              {t("create")}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
