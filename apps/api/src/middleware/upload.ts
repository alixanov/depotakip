import multer from "multer";
import { env } from "../config/env.js";

// First-pass guard: rejects obviously non-image declared MIME types early so
// we don't buffer multi-megabyte uploads we'll throw away. Magic-byte
// verification still runs server-side in the service — never trust the
// client-supplied Content-Type header.
function imageOnly(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("UNSUPPORTED_MEDIA"));
  }
}

export const lotPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.LOT_PHOTO_MAX_BYTES,
    files: env.LOT_PHOTO_MAX_COUNT,
  },
  fileFilter: imageOnly,
}).array("photos", env.LOT_PHOTO_MAX_COUNT);

// ── Bulk import (senders/carriers из CSV/XLSX) ────────────────────────────
// Принимаем один файл до 5 MB; формат строго ограничен (магнитная проверка
// внутри парсера). MIME клиентов разный: Excel ставит officedocument-MIME,
// но Files Explorer Windows иногда даёт ms-excel, текстовый редактор — plain.
const BULK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

function csvOrXlsxOnly(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ok =
    /\.(csv|xlsx)$/i.test(file.originalname) ||
    file.mimetype === "text/csv" ||
    file.mimetype === "application/csv" ||
    file.mimetype === "text/plain" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel";
  if (ok) cb(null, true);
  else cb(new Error("UNSUPPORTED_MEDIA"));
}

export const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_IMPORT_MAX_BYTES, files: 1 },
  fileFilter: csvOrXlsxOnly,
}).single("file");
