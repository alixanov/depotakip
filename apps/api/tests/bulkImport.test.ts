/**
 * Bulk-import (senders/carriers) — CSV/XLSX upload, дубликаты, валидация,
 * permission gate, template download.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  app,
  apiPath,
  authHeader,
  createTestUser,
  login,
  loginAs,
  ORG_ID,
  request,
} from "./helpers.ts";
import { Sender } from "../src/modules/senders/sender.model.ts";
import { Carrier } from "../src/modules/carriers/carrier.model.ts";
import { Role } from "../src/modules/access/role.model.ts";

const SENDERS_CSV_HEADER = "fullName,phone,address,notes\n";

function makeCsv(rows: string[][]): Buffer {
  const header = SENDERS_CSV_HEADER;
  const body = rows.map((cells) => cells.map(csvCell).join(",")).join("\n");
  return Buffer.from(header + body, "utf8");
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function makeXlsx(headers: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Import");
  sheet.addRow(headers);
  for (const r of rows) sheet.addRow(r);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe("POST /senders/bulk-import (CSV)", () => {
  it("создаёт всех валидных + отчёт", async () => {
    const op = await loginAs("operator");
    const csv = makeCsv([
      ["Akmal Karimov", "+998901111111", "Toshkent", ""],
      ["Dilshod T", "+998902222222", "Samarqand", ""],
      ["Sherzod Y", "+998903333333", "", "vip"],
    ]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.created).toBe(3);
    expect(res.body.skippedDuplicates).toBe(0);
    expect(res.body.failed).toEqual([]);
    const count = await Sender.countDocuments({ orgId: ORG_ID, deletedAt: null });
    expect(count).toBe(3);
  });

  it("skip дубликатов phone из БД (default)", async () => {
    const op = await loginAs("operator");
    // Seed: один уже существует.
    await request(app)
      .post(apiPath("/senders"))
      .set(...authHeader(op.accessToken))
      .send({ fullName: "Existing", phone: "+998901111111" })
      .expect(201);

    const csv = makeCsv([
      ["Akmal Karimov", "+998901111111", "", ""], // дубль
      ["Dilshod T", "+998902222222", "", ""], // новый
    ]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(1);
    expect(res.body.skippedDuplicates).toBe(1);
    expect(res.body.failed).toEqual([]);
  });

  it("?onDuplicate=update обновляет существующего", async () => {
    const op = await loginAs("operator");
    const created = await request(app)
      .post(apiPath("/senders"))
      .set(...authHeader(op.accessToken))
      .send({ fullName: "Original", phone: "+998901111111", address: "Old" })
      .expect(201);

    const csv = makeCsv([["Updated Name", "+998901111111", "New Address", ""]]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import?onDuplicate=update"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(0);
    expect(res.body.updated).toBe(1);

    const after = await Sender.findById(created.body.id);
    expect(after?.fullName).toBe("Updated Name");
    expect(after?.address).toBe("New Address");
  });

  it("дубликаты внутри файла → failed", async () => {
    const op = await loginAs("operator");
    const csv = makeCsv([
      ["A", "+998901111111", "", ""],
      ["B", "+998901111111", "", ""], // дубль в файле
    ]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].row).toBe(2);
    expect(res.body.failed[0].reason).toMatch(/Дубликат/);
  });

  it("невалидные строки попадают в failed с указанием поля", async () => {
    const op = await loginAs("operator");
    const csv = makeCsv([
      ["A", "+998901111111", "", ""], // OK
      ["", "+998902222222", "", ""], // пустой fullName
      ["C", "abc", "", ""], // невалидный phone
    ]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(2);
    expect(res.body.failed[0].row).toBe(2);
    expect(res.body.failed[1].row).toBe(3);
    expect(res.body.failed[1].reason).toMatch(/phone/);
  });

  it("пропускает полностью пустые строки", async () => {
    const op = await loginAs("operator");
    const csv = Buffer.from(
      SENDERS_CSV_HEADER + "A,+998901111111,,\n,,,\nB,+998902222222,,\n",
      "utf8"
    );
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.created).toBe(2);
  });

  it("strip UTF-8 BOM в начале файла", async () => {
    const op = await loginAs("operator");
    const csvWithBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      makeCsv([["A", "+998901111111", "", ""]]),
    ]);
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csvWithBom, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(1);
  });
});

describe("POST /senders/bulk-import (XLSX)", () => {
  it("парсит xlsx и создаёт записи", async () => {
    const op = await loginAs("operator");
    const xlsx = await makeXlsx(
      ["fullName", "phone", "address", "notes"],
      [
        ["Aybek", "+998904444444", "Toshkent", ""],
        ["Otabek", "+998905555555", "", "vip"],
      ]
    );
    const res = await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", xlsx, {
        filename: "senders.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.created).toBe(2);
  });
});

describe("POST /senders/bulk-import — RBAC", () => {
  it("viewer (без senders:write) → 403", async () => {
    const v = await loginAs("viewer");
    const csv = makeCsv([["A", "+998901111111", "", ""]]);
    await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(v.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(403);
  });

  it("operator → ok", async () => {
    const op = await loginAs("operator");
    const csv = makeCsv([["A", "+998901111111", "", ""]]);
    await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "senders.csv", contentType: "text/csv" })
      .expect(200);
  });
});

describe("POST /senders/bulk-import — отказы", () => {
  it("без file → 400", async () => {
    const op = await loginAs("operator");
    await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .expect(400);
  });

  it("чужой MIME → 415", async () => {
    const op = await loginAs("operator");
    await request(app)
      .post(apiPath("/senders/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", Buffer.from("hello"), { filename: "x.txt", contentType: "image/jpeg" })
      .expect(415);
  });
});

describe("GET /senders/import-template.xlsx", () => {
  it("возвращает xlsx с заголовками", async () => {
    const op = await loginAs("operator");
    const res = await request(app)
      .get(apiPath("/senders/import-template.xlsx"))
      .set(...authHeader(op.accessToken))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK");

    // Проверяем что заголовки соответствуют контракту.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((res.body as Buffer).buffer.slice(0) as ArrayBuffer);
    const sheet = wb.worksheets[0];
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => headers.push(String(cell.value)));
    expect(headers).toEqual(["fullName", "phone", "address", "notes"]);
  });
});

describe("POST /carriers/bulk-import", () => {
  it("создаёт carriers (5 колонок)", async () => {
    const op = await loginAs("operator");
    const csv = Buffer.from(
      "firstName,lastName,phone,deliveryAddressTr,notes\n" +
        "Mehmet,Yıldız,+905551111111,İstanbul,\n" +
        "Mustafa,Şahin,+905552222222,Ankara,\n",
      "utf8"
    );
    const res = await request(app)
      .post(apiPath("/carriers/bulk-import"))
      .set(...authHeader(op.accessToken))
      .attach("file", csv, { filename: "carriers.csv", contentType: "text/csv" })
      .expect(200);
    expect(res.body.created).toBe(2);
    const count = await Carrier.countDocuments({ orgId: ORG_ID, deletedAt: null });
    expect(count).toBe(2);
  });

  it("кастомная роль с carriers:write+read но без carriers:delete всё равно может импортировать", async () => {
    // bulk-import гейтуется carriers:write, не carriers:delete.
    const role = await Role.create({
      orgId: ORG_ID,
      name: `import-${Date.now()}`,
      description: "test",
      permissions: ["carriers:read", "carriers:write"],
      isSystem: false,
    });
    const { user, password } = await createTestUser({ roleId: role._id });
    const session = await login(user.email, password);
    const csv = Buffer.from(
      "firstName,lastName,phone,deliveryAddressTr,notes\nM,Y,+905553333333,Ankara,\n",
      "utf8"
    );
    await request(app)
      .post(apiPath("/carriers/bulk-import"))
      .set(...authHeader(session.accessToken))
      .attach("file", csv, { filename: "carriers.csv", contentType: "text/csv" })
      .expect(200);
  });
});
