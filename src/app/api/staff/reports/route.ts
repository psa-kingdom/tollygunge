import { permittedReports, reportName, reportFilters } from "@/domain/reports";
import { reportQuery } from "@/lib/report-query";
import { operation, authorized, OperationError } from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!actor.roles.length)
      throw new OperationError("Staff access required.", 403);
    const params = new URL(request.url).searchParams,
      filters = reportFilters(params),
      allowed = permittedReports(actor.roles);
    if (params.get("catalog") === "true") return { available: allowed };
    if (params.has("report")) {
      const name = reportName(params.get("report"));
      if (!allowed.includes(name))
        throw new OperationError("Access denied.", 403);
      const result = await reportQuery(name, filters, 201);
      return {
        ...result,
        rows: result.rows.slice(0, 200),
        previewLimited: result.rows.length > 200,
        report: name,
        filters,
        available: allowed,
      };
    }
    const entries = await Promise.all(
      allowed.map(async (name) => {
        const result = await reportQuery(name, filters, 200);
        return [
          name,
          name === "newsletter" ? result.rows[0] : result.rows,
        ] as const;
      }),
    );
    return Object.fromEntries(entries);
  });
}
