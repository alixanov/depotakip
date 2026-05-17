import type { Response } from "express";
import ExcelJS from "exceljs";

export type ReportFormat = "csv" | "xlsx";

interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  width?: number;
}

/** Stream a report payload as CSV or XLSX directly to the response. */
export async function streamReport<T extends Record<string, unknown>>(
  res: Response,
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  format: ReportFormat
): Promise<void> {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.write("﻿"); // BOM for Excel-friendly UTF-8
    res.write(columns.map((c) => csv(c.header)).join(",") + "\n");
    for (const row of rows) {
      res.write(columns.map((c) => csv(String(row[c.key as keyof T] ?? ""))).join(",") + "\n");
    }
    res.end();
    return;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false,
  });
  const sheet = workbook.addWorksheet("Rapor");
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: String(c.key),
    width: c.width ?? 18,
  }));
  for (const row of rows) sheet.addRow(row).commit();
  await sheet.commit();
  await workbook.commit();
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
