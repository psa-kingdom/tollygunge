import "server-only";
import { financeTotals } from "@/domain/finance";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { financeRead } from "./finance";
export type FinanceReport = Awaited<ReturnType<typeof financeRead>>;
const money = (v: number) =>
  `INR ${(v / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export async function financeExport(
  data: FinanceReport,
  format: "pdf" | "xlsx",
  eventPeriod?: string,
) {
  const title = data.filters.eventId
    ? (data.events.find((e) => e.id === data.filters.eventId)?.title ??
      "Event account")
    : eventPeriod
      ? "Filtered event finance report"
      : "Consolidated finance report";
  const generated = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
    range =
      eventPeriod ??
      `${data.filters.from ?? "Beginning"} to ${data.filters.to ?? "Present"}`;
  const approved = data.entries.filter((e) => e.status === "approved"),
    pending = data.entries.filter((e) => e.status === "submitted");
  const summary = [
    ["Approved receipts", data.totals.received],
    ["Recorded refunds", data.totals.refunded],
    ["Approved event expenses", data.totals.expenses],
    ["Net surplus (+) / deficit (-)", data.totals.netResult],
    ["Pending receipts (excluded)", data.totals.pendingReceipts],
    ["Pending expenses (excluded)", data.totals.pendingExpenses],
  ] as [string, number][];
  const receipts = (entries: typeof data.entries) =>
    entries
      .filter((e) => e.kind !== "expenses")
      .map((e) => [
        String(e.entry_date).slice(0, 10),
        e.event_title,
        e.participant_name ?? e.label,
        e.kind,
        e.reference,
        e.source,
        Number(e.amount_paise) / 100,
      ]);
  const expenses = (entries: typeof data.entries) =>
    entries
      .filter((e) => e.kind === "expenses")
      .flatMap((e) =>
        e.lines.map(
          (l: {
            date: string;
            header: string;
            description: string;
            amountPaise: number;
          }) => [
            l.date,
            e.event_title,
            l.header,
            l.description,
            e.source,
            Number(l.amountPaise) / 100,
          ],
        ),
      );
  type ReportGroup = {
    name: string;
    headers: string[];
    rows: (string | number)[][];
    eventHeading?: string;
  };
  const groups: ReportGroup[] = [
    {
      name: "Receipts and refunds",
      headers: [
        "Date",
        "Event",
        "Source / participant",
        "Type",
        "Reference",
        "Origin",
        "Amount (INR)",
      ],
      rows: receipts(approved),
    },
    {
      name: "Event expenses",
      headers: [
        "Date",
        "Event",
        "Header",
        "Description",
        "Origin",
        "Amount (INR)",
      ],
      rows: expenses(approved),
    },
    {
      name: "Pending receipts",
      headers: [
        "Date",
        "Event",
        "Source / participant",
        "Type",
        "Reference",
        "Origin",
        "Amount (INR)",
      ],
      rows: receipts(pending),
    },
    {
      name: "Pending expenses",
      headers: [
        "Date",
        "Event",
        "Header",
        "Description",
        "Origin",
        "Amount (INR)",
      ],
      rows: expenses(pending),
    },
  ];
  const eventReports = eventPeriod
    ? data.events.map((event) => {
        const entries = data.entries.filter(
          (entry) => entry.event_id === event.id,
        );
        const approvedEntries = entries.filter(
          (entry) => entry.status === "approved",
        );
        const pendingEntries = entries.filter(
          (entry) => entry.status === "submitted",
        );
        const totals = financeTotals(entries);
        const date = new Date(event.starts_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        });
        const heading = `${event.title} | ${date}${event.location ? " | " + event.location : ""}`;
        const withStatus = (rows: (string | number)[][], status: string) =>
          rows.map(([date, , ...values]) => [
            date,
            ...values.slice(0, -1),
            status,
            values.at(-1)!,
          ]);
        const sections: ReportGroup[] = [
          {
            name: "Collections and refunds",
            headers: [
              "Date",
              "Participant / source",
              "Type",
              "Reference",
              "Origin",
              "Status",
              "Amount (INR)",
            ],
            rows: [
              ...withStatus(receipts(approvedEntries), "Approved"),
              ...withStatus(receipts(pendingEntries), "Pending"),
            ],
          },
          {
            name: "Expenses",
            headers: [
              "Date",
              "Header",
              "Description",
              "Origin",
              "Status",
              "Amount (INR)",
            ],
            rows: [
              ...withStatus(expenses(approvedEntries), "Approved"),
              ...withStatus(expenses(pendingEntries), "Pending"),
            ],
          },
          {
            name: "Event totals",
            headers: ["Total", "Amount (INR)"],
            rows: [
              ["Collected", totals.received / 100],
              ["Refunded", totals.refunded / 100],
              ["Spent", totals.expenses / 100],
              [
                totals.netResult < 0
                  ? "Deficit"
                  : totals.netResult > 0
                    ? "Surplus"
                    : "Net balance",
                Math.abs(totals.netResult) / 100,
              ],
            ],
          },
        ];
        return { event, date, heading, totals, sections };
      })
    : [];
  if (eventPeriod) {
    summary.push([
      data.totals.netResult < 0
        ? "Period deficit"
        : data.totals.netResult > 0
          ? "Period surplus"
          : "Period balance",
      Math.abs(data.totals.netResult),
    ]);
    groups.splice(0, groups.length, {
      name: "Events",
      headers: [
        "Event",
        "Date",
        "Venue",
        "Participants",
        "Collected (INR)",
        "Spent (INR)",
        "Net balance (INR)",
      ],
      rows: eventReports.map(({ event, date, totals }) => [
        event.title,
        date,
        event.location,
        String(event.participant_count),
        totals.received / 100,
        totals.expenses / 100,
        totals.netResult / 100,
      ]),
    });
  }
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook();
    book.creator = "Tollygunge Professional Association";
    const sheet = book.addWorksheet("Summary");
    sheet.columns = [{ width: 44 }, { width: 32 }];
    sheet.addRow(["Tollygunge Professional Association"]);
    sheet.addRow([title]);
    sheet.addRow(["Period", range]);
    sheet.addRow(["Generated (Asia/Kolkata)", generated]);
    sheet.addRow([]);
    sheet.addRow(["Financial summary", "Amount (INR)"]);
    summary.forEach(([label, value]) => sheet.addRow([label, value / 100]));
    sheet.getColumn(2).numFmt = "#,##0.00;[Red]-#,##0.00";
    sheet.addRow([]);
    sheet.addRow(["Basis", "Approved entries only; pending entries excluded."]);
    sheet.addRow(["Legacy", "Historical records carried forward as approved."]);
    sheet.getColumn(2).alignment = { wrapText: true };
    sheet.getRow(1).font = { bold: true, size: 16 };
    sheet.getRow(2).font = { bold: true, size: 13 };
    for (const group of groups) {
      const s = book.addWorksheet(group.name, {
        views: [{ state: "frozen", ySplit: 4 }],
      });
      s.addRow(["Tollygunge Professional Association"]);
      s.addRow([title]);
      s.addRow([range]);
      s.addRow(group.headers);
      s.columns = group.headers.map((h, i) => ({
        width:
          i === group.headers.length - 1
            ? 22
            : ["Event", "Description", "Source / participant"].includes(h)
              ? 38
              : 24,
      }));
      group.rows.forEach((r) => s.addRow(r));
      if (group.name === "Events")
        for (const index of [5, 6])
          s.getColumn(index).numFmt = "#,##0.00;[Red]-#,##0.00";
      s.getColumn(group.headers.length).numFmt = "#,##0.00;[Red]-#,##0.00";
      s.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: Math.max(4, s.rowCount), column: group.headers.length },
      };
      s.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
      s.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF123047" },
      };
      s.eachRow((r) => {
        r.alignment = { vertical: "top", wrapText: true };
      });
      s.pageSetup = {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:4",
      };
    }
    for (const [index, report] of eventReports.entries()) {
      const sheet = book.addWorksheet(`Event ${index + 1}`, {
        views: [{ state: "frozen", ySplit: 3 }],
      });
      sheet.columns = [30, 34, 35, 27, 22, 20, 20].map((width) => ({ width }));
      sheet.mergeCells("A1:G1");
      sheet.getCell("A1").value = report.event.title;
      sheet.getCell("A1").font = { bold: true, size: 16 };
      sheet.mergeCells("A2:G2");
      sheet.getCell("A2").value = report.heading.slice(
        report.event.title.length + 3,
      );
      sheet.mergeCells("A3:G3");
      sheet.getCell("A3").value = `Period: ${range}`;
      for (const section of report.sections) {
        sheet.addRow([]);
        sheet.addRow([section.name]).font = { bold: true, size: 13 };
        const header = sheet.addRow(section.headers);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF123047" },
        };
        if (!section.rows.length) sheet.addRow(["No records"]);
        for (const values of section.rows) {
          const row = sheet.addRow(values);
          row.alignment = { wrapText: true, vertical: "top" };
          row.getCell(values.length).numFmt = "#,##0.00;[Red]-#,##0.00";
        }
      }
      sheet.pageSetup = {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:3",
      };
    }
    return new Uint8Array(await book.xlsx.writeBuffer());
  }
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }),
    width = 297,
    height = 210,
    margin = 14;
  let y = 18;
  const logo = await readFile(
    join(process.cwd(), "public/design/tpa-logo.png"),
  );
  pdf.addImage(new Uint8Array(logo), "PNG", margin, 10, 16, 16);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Tollygunge Professional Association", margin + 21, 17);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(title, 230), margin, 35);
  y = 45;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const periodLines = pdf.splitTextToSize(
    `Period: ${range} | Generated: ${generated} (India)`,
    width - margin * 2,
  );
  pdf.text(periodLines, margin, y);
  y += 5 * periodLines.length + 4;
  summary.forEach(([label, value]) => {
    pdf.text(label, margin, y);
    pdf.text(money(value), 140, y, { align: "right" });
    y += 6;
  });
  y += 6;
  let activeEvent: string | undefined;
  function page() {
    pdf.addPage();
    y = 18;
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(activeEvent ?? title, width - margin * 2);
    pdf.text(lines, margin, y);
    y += 5 * lines.length + 3;
  }
  const pdfGroups = [
    ...groups,
    ...eventReports.flatMap((report) =>
      report.sections.map((section, index) => ({
        ...section,
        eventHeading: index === 0 ? report.heading : undefined,
      })),
    ),
  ];
  for (const group of pdfGroups) {
    if (group.eventHeading) {
      activeEvent = group.eventHeading;
      page();
    } else if (y > height - 40) page();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(group.name, margin, y);
    y += 7;
    const cols = group.headers.length,
      colWidth = (width - margin * 2) / cols;
    function header() {
      pdf.setFillColor(18, 48, 71);
      pdf.rect(margin, y - 4, width - margin * 2, 9, "F");
      pdf.setTextColor(255);
      pdf.setFontSize(8);
      group.headers.forEach((h, i) =>
        pdf.text(h, margin + i * colWidth + 2, y),
      );
      pdf.setTextColor(0);
      pdf.setFont("helvetica", "normal");
      y += 9;
    }
    header();
    if (!group.rows.length) {
      pdf.text("No records", margin, y);
      y += 8;
    }
    for (const row of group.rows) {
      const cells = row.map(
        (v: string | number) =>
          pdf.splitTextToSize(
            typeof v === "number" ? money(Math.round(v * 100)) : String(v),
            colWidth - 4,
          ) as string[],
      );
      const rowHeight =
        Math.max(...cells.map((c: string[]) => c.length)) * 4 + 4;
      if (y + rowHeight > height - 15) {
        page();
        header();
      }
      cells.forEach((cell: string[], i: number) =>
        pdf.text(
          cell,
          margin +
            i * colWidth +
            (typeof row[i] === "number" ? colWidth - 2 : 2),
          y,
          { align: typeof row[i] === "number" ? "right" : "left" },
        ),
      );
      pdf.setDrawColor(210);
      pdf.line(margin, y + rowHeight - 4, width - margin, y + rowHeight - 4);
      y += rowHeight;
    }
    y += 10;
  }
  const pages = pdf.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    pdf.setPage(n);
    pdf.setFontSize(8);
    pdf.text(
      `Approved totals exclude pending submissions. Legacy records retain historical approval. | Page ${n} of ${pages}`,
      margin,
      height - 7,
    );
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
