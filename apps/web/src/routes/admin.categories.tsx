import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createCategorySchema, type Category, type CreateCategoryInput } from "@sadiyakargo/shared";
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
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldError, FormError } from "@/components/ui/form-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "lucide-react";
import { categoriesApi } from "@/lib/api/categories";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { useUndoableDelete } from "@/lib/useUndoableDelete";
import { requireRole } from "@/lib/guards";

export const Route = createFileRoute("/admin/categories")({
  beforeLoad: requireRole("admin"),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { t } = useTranslation();

  const query = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });

  // 5-second undo window; deletion fires only if the user doesn't click Undo.
  const deleteWithUndo = useUndoableDelete({
    queryKey: ["categories"],
    deleteFn: (id) => categoriesApi.remove(id),
    toastTitle: t("admin:categories_title") + " — " + t("delete"),
  });

  // Optimistic toggle: flip UI immediately, roll back on error.
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      categoriesApi.update(id, { active }),
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ["categories"] });
      const previous = qc.getQueryData<Category[]>(["categories"]);
      qc.setQueryData<Category[]>(["categories"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, active } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["categories"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const columns: Column<Category>[] = [
    {
      key: "icon",
      header: "",
      cell: (c) => <span className="text-lg">{c.icon || "📦"}</span>,
      width: "48px",
    },
    {
      key: "name",
      header: t("admin:col_icon_label"),
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    { key: "sortOrder", header: t("admin:col_sort"), cell: (c) => c.sortOrder, width: "80px" },
    {
      key: "active",
      header: t("admin:col_status"),
      cell: (c) => (
        <button
          type="button"
          onClick={() => toggleActive.mutate({ id: c.id, active: !c.active })}
          className={
            c.active
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
              : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600"
          }
        >
          {c.active ? t("admin:active") : t("admin:inactive")}
        </button>
      ),
      width: "100px",
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmId(c.id)}
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
      width: "60px",
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin:categories_title")}</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t("admin:btn_new_category")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={query.data}
            loading={query.isLoading}
            error={query.error as Error | null}
            rowKey={(c) => c.id}
            empty={
              <EmptyState
                icon={<Tag />}
                title={t("admin:no_categories_yet")}
                action={
                  <Button onClick={() => setDialogOpen(true)} variant="brand" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin:btn_new_category")}
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      <CreateCategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title={t("delete") + " — " + t("admin:categories_title")}
        description={t("admin:delete_category_desc")}
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

function CreateCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();
  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", icon: "", sortOrder: 0, active: true },
  });
  const handleApiError = useApiFormErrors(form);

  const create = useMutation({
    mutationFn: (data: CreateCategoryInput) => categoriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => setServerError(handleApiError(err)),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("admin:btn_new_category")}</ResponsiveDialogTitle>
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
            <Label>{t("admin:col_icon_label")}</Label>
            <Input {...form.register("name")} autoFocus />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin:icon_label")}</Label>
              <Input {...form.register("icon")} placeholder="📦" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin:col_sort")}</Label>
              <Input type="number" {...form.register("sortOrder", { valueAsNumber: true })} />
            </div>
          </div>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t("create")}
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
