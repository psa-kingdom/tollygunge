import ExcelJS from "exceljs";
import {
  permittedReports,
  reportName,
  reportFilters,
  reportDefinitions,
  csvText,
  exportLimit,
} from "@/domain/reports";
import { reportQuery } from "@/lib/report-query";
import {
  authorized,
  OperationError,
  transaction,
  audit,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const actor = await authorized(request),
      params = new URL(request.url).searchParams,
      name = reportName(params.get("report")),
      filters = reportFilters(params),
      format = params.get("format");
    if (!permittedReports(actor.roles).includes(name))
      throw new OperationError("Access denied.", 403);
    if (format !== "csv" && format !== "xlsx")
      throw new OperationError("Choose CSV or XLSX.");
    const result = await reportQuery(name, filters, 10001);
    exportLimit(result.rows.length);
    const value = (v: unknown): string | number | boolean =>
      v instanceof Date
        ? v.toISOString()
        : typeof v === "number" || typeof v === "boolean"
          ? v
          : String(v ?? "");
    let body: BodyInit;
    if (format === "csv")
      body =
        "\uFEFF" +
        [
          result.columns.map(csvText).join(","),
          ...result.rows.map((row) =>
            result.columns.map((c) => csvText(value(row[c]))).join(","),
          ),
        ].join("\r\n");
    else {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Tollygunge Professional Association";
      const sheet = workbook.addWorksheet("Report", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      sheet.columns = result.columns.map((key) => ({
        key,
        header: key.replaceAll("_", " "),
        width: key === "email" || key === "title" ? 38 : 24,
      }));
      result.rows.forEach((row) =>
        sheet.addRow(
          Object.fromEntries(result.columns.map((c) => [c, value(row[c])])),
        ),
      );
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF123047" },
      };
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, sheet.rowCount), column: result.columns.length },
      };
      const meta = workbook.addWorksheet("Metadata");
      meta.columns = [
        { header: "Setting", key: "key", width: 28 },
        { header: "Value", key: "value", width: 100 },
      ];
      meta.addRows([
        { key: "Report", value: reportDefinitions[name].label },
        { key: "Generated UTC", value: new Date().toISOString() },
        { key: "Date timezone", value: "Asia/Kolkata (India)" },
        { key: "Timestamp cells", value: "ISO 8601 UTC" },
        { key: "Meaning", value: reportDefinitions[name].meaning },
        { key: "Matching rows", value: result.rows.length },
        {
          key: "Applied filters",
          value: JSON.stringify({ ...filters, ...result.range }),
        },
        {
          key: "Privacy",
          value:
            "No private documents, authentication secrets or pending personal details.",
        },
      ]);
      meta.getColumn(2).alignment = { wrapText: true };
      meta.getRow(1).font = { bold: true };
      meta.views = [{ state: "frozen", ySplit: 1 }];
      body = new Uint8Array(await workbook.xlsx.writeBuffer()) as BodyInit;
    }
    await transaction((client) =>
      audit(client, actor.id, `report.export.${format}`, name),
    );
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type":
          format === "csv"
            ? "text/csv;charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tpa-${name}-report.${format}"`,
      },
    });
  } catch (error) {
    const safe =
      error instanceof Error &&
      !("code" in error) &&
      /^(Choose|More than|Check|Start date)/.test(error.message);
    return Response.json(
      {
        error:
          error instanceof OperationError
            ? error.message
            : safe
              ? (error as Error).message
              : "Unable to export. Please retry.",
      },
      { status: error instanceof OperationError ? error.status : 400, headers },
    );
  }
}
