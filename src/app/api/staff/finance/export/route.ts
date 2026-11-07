import {
  financeTotals,
  matchesFinanceEvent,
  financePeriodLabel,
} from "@/domain/finance";
import {
  authorized,
  OperationError,
  transaction,
  audit,
} from "@/lib/operation-api";
import { financeRead } from "@/lib/finance";
import { financeExport } from "@/lib/finance-export";
export const runtime = "nodejs";
export async function GET(r: Request) {
  try {
    const actor = await authorized(r, "payments:manage"),
      params = new URL(r.url).searchParams,
      format = params.get("format");
    if (format !== "pdf" && format !== "xlsx")
      throw new OperationError("Choose PDF or Excel.");
    const data = await financeRead(params);
    const filtered = params.get("scope") === "events" && !data.filters.eventId;
    let eventPeriod: string | undefined;
    if (filtered) {
      const filters = {
        q: params.get("q") ?? "",
        year: params.get("year") ?? "",
        months: (params.get("months") ?? params.get("month") ?? "")
          .split(",")
          .filter(Boolean),
      };
      if (
        filters.q.length > 160 ||
        (filters.year && !/^\d{4}$/.test(filters.year)) ||
        filters.months.length > 12 ||
        filters.months.some((month) => !/^(0[1-9]|1[0-2])$/.test(month))
      ) {
        throw new OperationError("Choose valid event filters.");
      }
      eventPeriod =
        financePeriodLabel(filters) +
        (filters.q.trim() ? ` | Search: ${filters.q.trim()}` : "");
      data.events = data.events.filter((event) =>
        matchesFinanceEvent(event, filters),
      );
      const ids = new Set(data.events.map((event) => event.id));
      data.entries = data.entries.filter((entry) => ids.has(entry.event_id));
      data.totals = financeTotals(data.entries);
    }
    if (
      data.entries.reduce((n, e) => n + Math.max(1, e.lines.length), 0) > 10000
    )
      throw new OperationError(
        "Narrow the filters to fewer than 10,000 records.",
      );
    const body = await financeExport(data, format, eventPeriod);
    await transaction((c) =>
      audit(
        c,
        actor.id,
        "finance.export." + format,
        data.filters.eventId ?? "all",
      ),
    );
    return new Response(body as BodyInit, {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tpa-finance.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof OperationError
            ? error.message
            : "Unable to export this report.",
      },
      {
        status: error instanceof OperationError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
