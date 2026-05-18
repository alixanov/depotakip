import ExcelJS from "exceljs";
import { badRequest } from "./errors.js";

/** Bulk-import парсер для senders/carriers. Одна строка = один сущ-кандидат.
 *
 *  Контракт:
 *  - Первая строка файла — header (имена полей).
 *  - Колонки с пустым/whitespace-only header игнорируются.
 *  - Полностью пустые строки скипаются (не считаются в `total`).
 *  - row нумеруется с 1 для НЕ-header строк (соответствует человеческому
 *    восприятию «строка #1 в Excel под шапкой»).
 *
 *  Лимиты:
 *  - MAX_FILE_BYTES применяется снаружи через multer — здесь нет.
 *  - MAX_ROWS защищает от больших файлов (память + время обработки).
 */
export const BULK_IMPORT_MAX_ROWS = 5000;
export const BULK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface BulkImportRow {
  /** 1-based номер строки без учёта header (для отчётов оператору). */
  row: number;
  data: Record<string, string>;
}

export interface BulkImportFile {
  rows: BulkImportRow[];
  format: "csv" | "xlsx";
}

/** Угадываем формат по имени/MIME. Multer уже отфильтровал чужие MIME. */
function detectFormat(filename: string, mimeType: string): "csv" | "xlsx" {
  if (/\.xlsx$/i.test(filename)) return "xlsx";
  if (/\.csv$/i.test(filename)) return "csv";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "xlsx";
  }
  return "csv";
}

export async function parseBulkImportFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<BulkImportFile> {
  const format = detectFormat(filename, mimeType);
  if (format === "xlsx") {
    const rows = await parseXlsx(buffer);
    return { rows, format };
  }
  const rows = parseCsv(buffer);
  return { rows, format };
}

async function parseXlsx(buffer: Buffer): Promise<BulkImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS типы из @types/exceljs ожидают legacy `Buffer` без generic.
    // В Node 22 `Buffer` это `Buffer<ArrayBufferLike>` — несовместимо на
    // уровне TS, но на runtime просто Uint8Array-вью. ArrayBuffer slice
    // даёт чистый ArrayBuffer, который ExcelJS принимает как input.
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    await workbook.xlsx.load(ab as ArrayBuffer);
  } catch {
    throw badRequest("err:xlsx_corrupted");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw badRequest("err:xlsx_no_sheet");

  // Header — первая строка. ExcelJS читает row 1, getCell идёт с 1.
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  // Используем actualColumnCount, чтобы не упереться в дефолтные пустые столбцы.
  const colCount = Math.max(sheet.actualColumnCount, sheet.columnCount);
  for (let c = 1; c <= colCount; c += 1) {
    const value = headerRow.getCell(c).value;
    headers[c - 1] = value == null ? "" : String(value).trim();
  }
  if (headers.every((h) => !h)) throw badRequest("err:bulk_empty_header");

  const rows: BulkImportRow[] = [];
  const rowCount = sheet.actualRowCount;
  for (let r = 2; r <= rowCount; r += 1) {
    const xlsxRow = sheet.getRow(r);
    const data: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) continue;
      const cellValue = xlsxRow.getCell(c + 1).value;
      const stringValue = cellValue == null ? "" : String(cellValue).trim();
      data[header] = stringValue;
      if (stringValue) hasValue = true;
    }
    if (!hasValue) continue;
    rows.push({ row: r - 1, data });
    if (rows.length > BULK_IMPORT_MAX_ROWS) {
      throw badRequest("err:bulk_rows_max", { max: BULK_IMPORT_MAX_ROWS });
    }
  }
  return rows;
}

function parseCsv(buffer: Buffer): BulkImportRow[] {
  // strip UTF-8 BOM (U+FEFF) — Excel при экспорте CSV его ставит, иначе
  // первое поле получит невидимый префикс и валидация уплывёт.
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = parseCsvLines(text);
  if (lines.length === 0) throw badRequest("err:csv_empty");
  const headers = lines[0].map((h) => h.trim());
  if (headers.every((h) => !h)) throw badRequest("err:bulk_empty_header");

  const rows: BulkImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i];
    const data: Record<string, string> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) continue;
      const value = (cells[c] ?? "").trim();
      data[header] = value;
      if (value) hasValue = true;
    }
    if (!hasValue) continue;
    rows.push({ row: i, data });
    if (rows.length > BULK_IMPORT_MAX_ROWS) {
      throw badRequest("err:bulk_rows_max", { max: BULK_IMPORT_MAX_ROWS });
    }
  }
  return rows;
}

/** Парсер CSV без зависимостей: поддерживает "..." quoting, "" escape внутри
 *  кавычек, \r\n и \n line endings, последнюю строку без \n. Намеренно простой
 *  — для bulk-import достаточно. Если когда-нибудь понадобится more edge-cases
 *  (multi-line cells, разные delimiter'ы), мигрируем на csv-parse.
 */
function parseCsvLines(text: string): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      current.push(cell);
      cell = "";
      if (current.some((c) => c !== "")) result.push(current);
      current = [];
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || current.length > 0) {
    current.push(cell);
    if (current.some((c) => c !== "")) result.push(current);
  }
  return result;
}

/** Build XLSX template buffer для скачивания. Headers задаются вызывающим. */
export async function buildTemplateXlsx(
  headers: string[],
  exampleRow?: Record<string, string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import");
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
  if (exampleRow) {
    sheet.addRow(exampleRow);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
