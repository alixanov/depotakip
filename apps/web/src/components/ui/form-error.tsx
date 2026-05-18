import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Если message — наш ключ ("validation:xxx" или "err:xxx") — переводим;
 *  иначе показываем как есть. Zod custom-messages (через `.regex(...,"...")`)
 *  попадают прямо в `errors.X.message` минуя errorMap, поэтому единое место
 *  перевода — display layer. ReactNode не строка → возвращаем без изменений. */
function translateMaybe(value: ReactNode, t: (key: string) => string): ReactNode {
  if (typeof value !== "string") return value;
  if (value.startsWith("validation:") || value.startsWith("err:")) {
    const translated = t(value);
    // i18next возвращает сам ключ при отсутствии перевода — показываем raw
    // value (на случай если кто-то по ошибке кинул несуществующий ключ).
    return translated && translated !== value ? translated : value;
  }
  return value;
}

export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  const { t } = useTranslation();
  if (!children) return null;
  return (
    <p className={cn("rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}>
      {translateMaybe(children, t)}
    </p>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  if (!children) return null;
  return <p className="text-xs text-destructive">{translateMaybe(children, t)}</p>;
}
