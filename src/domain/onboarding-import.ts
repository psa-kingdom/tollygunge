import ExcelJS from "exceljs";
export type ImportRow = {
  name: string;
  email: string;
  details: Record<string, string>;
  category?: string;
  plan?: string;
  error?: string;
};
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!cell || quoted) quoted = !quoted;
      else throw Error("Malformed CSV quote.");
    } else if (c === "," && !quoted) {
      row.push(cell);
      if (row.length > 100) throw Error("Maximum 100 columns.");
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      if (rows.length > 1001) throw Error("Maximum 1,000 rows.");
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export async function importCells(bytes: Uint8Array, filename: string) {
  if (bytes.length > 5 * 1024 * 1024) throw Error("Maximum file size is 5 MB.");
  if (filename.toLowerCase().endsWith(".csv"))
    return parseCsv(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ""));
  if (!filename.toLowerCase().endsWith(".xlsx"))
    throw Error("Choose CSV or XLSX.");
  // Bound ZIP expansion before ExcelJS allocates worksheet contents.
  const zip = Buffer.from(bytes);
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw Error("Malformed XLSX archive.");
  const entries = zip.readUInt16LE(end + 10);
  let position = zip.readUInt32LE(end + 16),
    expanded = 0;
  if (entries > 5000) throw Error("XLSX archive is too complex.");
  for (let i = 0; i < entries; i++) {
    if (position + 46 > zip.length || zip.readUInt32LE(position) !== 0x02014b50)
      throw Error("Malformed XLSX archive.");
    expanded += zip.readUInt32LE(position + 24);
    if (expanded > 32 * 1024 * 1024)
      throw Error("Expanded XLSX content exceeds 32 MB.");
    position +=
      46 +
      zip.readUInt16LE(position + 28) +
      zip.readUInt16LE(position + 30) +
      zip.readUInt16LE(position + 32);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  if (workbook.worksheets.length !== 1) throw Error("Use one worksheet.");
  const rows: string[][] = [];
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > 1001 || sheet.columnCount > 100)
    throw Error("Maximum 1,000 rows and 100 columns.");
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, index) => {
      if (
        c.type === ExcelJS.ValueType.Formula ||
        (c.value && typeof c.value === "object" && "formula" in c.value)
      )
        throw Error("Formula cells are not accepted.");
      values[index - 1] = c.value instanceof Date ? c.value.toISOString().slice(0,10) : c.text;
    });
    rows.push(values);
  });
  return rows;
}
export function mapImport(
  cells: string[][],
  mapping: Record<string, string>,
  allowed: string[],
): ImportRow[] {
  if (cells.length < 2 || cells.length > 1001 || cells[0].length > 100)
    throw Error("Use 1–1,000 data rows.");
  const headers = cells[0].map((x) => x.trim());
  if (new Set(headers).size !== headers.length)
    throw Error("Column headings must be unique.");
  if (!mapping.name || !mapping.email) throw Error("Map name and email.");
  const forbidden = /password|role|verified|badge|token|secret/i;
  if (
    headers.some((x) => forbidden.test(x)) ||
    Object.keys(mapping).some((x) => forbidden.test(x))
  )
    throw Error("Passwords, roles and verification cannot be imported.");
  if (
    Object.keys(mapping).some(
      (x) => !["name", "email", "category", "plan", ...allowed].includes(x),
    ) ||
    Object.values(mapping).some((x) => !headers.includes(x))
  )
    throw Error("Check column mappings.");
  const seen = new Set<string>();
  return cells.slice(1).map((row) => {
    const value = (key: string) =>
        String(row[headers.indexOf(mapping[key])] ?? "").trim(),
      name = value("name"),
      email = value("email").toLowerCase(),
      details: Record<string, string> = { fullName: name };
    const category = value("category") || "Professional",
      plan = value("plan") || "Annual";
    let error =
      ["Professional", "Student"].includes(category) &&
      ["Annual", "Life", "Patron"].includes(plan)
        ? ""
        : "Check category or plan.";
    if (
      !name ||
      name.length > 120 ||
      !/^\S+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    )
      error = "Name and valid email are required.";
    if (
      row.some(
        (x) =>
          (/^[=+@]/.test(x?.trim() ?? "") &&
            !/^\+\d[\d ().-]*$/.test(x?.trim() ?? "")) ||
          /^-\D/.test(x?.trim() ?? ""),
      )
    )
      error = "Formula-like cell content is not accepted.";
    if (seen.has(email)) error = "Duplicate email in file.";
    seen.add(email);
    for (const key of allowed) if (mapping[key]) details[key] = value(key);
    if (Object.values(details).some((x) => x.length > 5000))
      error = "An answer is too long.";
    return {
      name,
      email,
      category,
      plan,
      details,
      ...(error ? { error } : {}),
    };
  });
}
