import type { PdfLocale } from "@sadiyakargo/pdf-templates";

/**
 * Resolve the PDF language for a request. Reads `?lang=...` first; falls
 * back to `tr` (the spec default) if unset or malformed. The web client
 * appends `?lang=<current>` from `useUiStore.lang` when building download
 * URLs — see `downloadReceiptPdf` / `downloadWaybillPdf`.
 */
export function pdfLangFromQuery(q: unknown): PdfLocale {
  if (q === "ru" || q === "uz" || q === "tr") return q;
  return "tr";
}
