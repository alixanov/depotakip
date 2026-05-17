import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  createUserSchema,
  ROLES,
  type CreateUserInput,
  type Role,
  type User,
} from "@sadiyakargo/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, FormError } from "@/components/ui/form-error";
import { usersApi } from "@/lib/api/users";
import { useApiFormErrors } from "@/lib/useApiFormErrors";
import { requireRole } from "@/lib/guards";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: requireRole("admin"),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tempPasswordToast, setTempPasswordToast] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const { t } = useTranslation();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ limit: 100 }),
  });

  // Optimistic role/active toggle — flip the cached list immediately, roll
  // back on failure. Users list is paginated, so we patch any page that
  // happens to contain the user.
  type UsersPage = ReturnType<typeof usersApi.list> extends Promise<infer R> ? R : never;
  const updateMutation = useMutation({
    mutationFn: (args: { id: string; data: { role?: Role; active?: boolean } }) =>
      usersApi.update(args.id, args.data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const snapshots = qc.getQueriesData<UsersPage>({ queryKey: ["users"] });
      for (const [key, value] of snapshots) {
        if (!value) continue;
        qc.setQueryData<UsersPage>(key, {
          ...value,
          data: value.data.map((u) => (u.id === id ? { ...u, ...data } : u)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, value] of ctx.snapshots) qc.setQueryData(key, value);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin:users_title")}</h2>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? t("cancel") : t("admin:btn_new_user")}
        </Button>
      </div>

      {tempPasswordToast && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              <span className="font-semibold">{t("admin:user_form_temp_password")}</span>{" "}
              <code className="rounded bg-muted px-2 py-1">{tempPasswordToast}</code>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("admin:user_form_temp_password_hint")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setTempPasswordToast(null)}
            >
              {t("admin:user_form_close")}
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <NewUserForm
          onCreated={(temp) => {
            setShowForm(false);
            setTempPasswordToast(temp);
          }}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {usersQuery.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">{t("loading")}</p>
          )}
          {usersQuery.error && (
            <p className="p-4 text-sm text-destructive">{(usersQuery.error as Error).message}</p>
          )}
          {usersQuery.data && (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">{t("admin:col_name")}</th>
                  <th className="p-3">{t("admin:col_email")}</th>
                  <th className="p-3">{t("admin:col_role")}</th>
                  <th className="p-3">{t("admin:col_status")}</th>
                  <th className="p-3 text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.data.map((u: User) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{u.fullName}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: u.id,
                            data: { role: e.target.value as Role },
                          })
                        }
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: u.id,
                            data: { active: !u.active },
                          })
                        }
                        className={
                          u.active
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600"
                        }
                      >
                        {u.active ? t("admin:active") : t("admin:inactive")}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmUser(u)}
                        aria-label={`${t("delete")} — ${u.email}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {usersQuery.data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      {t("admin:no_users_yet")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmUser}
        onOpenChange={(o) => !o && setConfirmUser(null)}
        title={t("admin:delete_user_title")}
        description={
          confirmUser ? (
            <>
              <span className="font-semibold">{confirmUser.email}</span> —{" "}
              {t("admin:delete_user_desc")}
            </>
          ) : null
        }
        confirmLabel={t("admin:delete_user_confirm")}
        destructive
        // Require operator to retype the email — irreversible (soft-deletes
        // the user + revokes refresh tokens server-side; no undo path).
        requireType={confirmUser?.email}
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (!confirmUser) return;
          deleteMutation.mutate(confirmUser.id, { onSettled: () => setConfirmUser(null) });
        }}
      />
    </div>
  );
}

function NewUserForm({ onCreated }: { onCreated: (tempPassword: string) => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState("");
  const { t } = useTranslation();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", fullName: "", phone: "", role: "operator" },
  });
  const handleApiError = useApiFormErrors(form);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onCreated(res.tempPassword);
      form.reset();
    },
    onError: (err) => {
      setServerError(handleApiError(err));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin:btn_new_user")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((d) => {
            setServerError("");
            createMutation.mutate(d);
          })}
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormError>{serverError}</FormError>

          <div className="space-y-1.5">
            <Label>{t("admin:col_name")}</Label>
            <Input {...form.register("fullName")} autoComplete="name" />
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:col_email")}</Label>
            <Input type="email" {...form.register("email")} autoComplete="email" />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:user_form_phone")}</Label>
            <Input {...form.register("phone")} autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin:user_form_role")}</Label>
            <select
              {...form.register("role")}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" loading={form.formState.isSubmitting}>
              {t("create")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
