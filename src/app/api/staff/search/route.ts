import { authorized, operation, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { staffNavigation } from "@/domain/staff-navigation";
import {
  permittedSearchSources,
  searchPattern,
} from "@/domain/workspace-search";
import { permittedReports } from "@/domain/reports";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!actor.roles.length) throw new OperationError("Access denied.", 403);
    const q = (new URL(request.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 120);
    const results: {
      id: string;
      group: string;
      title: string;
      summary: string;
      href: string;
    }[] = staffNavigation(actor.roles)
      .flatMap((g) => g.items)
      .filter((x) => !q || x.label.toLowerCase().includes(q.toLowerCase()))
      .map((x) => ({
        id: x.href,
        group: "Workspaces",
        title: x.label,
        summary: "Open workspace",
        href: x.href,
      }));
    if (q.length >= 2) {
      for (const source of permittedSearchSources(actor.roles)) {
        const searchRequest = {
          text: source.sql,
          values: source.owned
            ? [searchPattern(q), actor.id]
            : [searchPattern(q)],
          query_timeout: 5000,
        };
        const rows = (await getDatabase().query(searchRequest)).rows;
        for (const row of rows)
          results.push({
            id: row.id,
            title: String(row.title).slice(0, 160),
            summary: String(row.summary ?? "").slice(0, 180),
            group: source.group,
            href: source.path.endsWith("/")
              ? source.path + encodeURIComponent(row.id)
              : source.path +
                "?" +
                (source.parameter || "id") +
                "=" +
                encodeURIComponent(row.id),
          });
      }
    }
    if (q.length >= 2) {
      const presets = (
        await getDatabase().query(
          "SELECT id,name,report FROM tpa.report_presets WHERE (owner_user_id=$2 OR visibility='shared') AND report=ANY($3::text[]) AND concat_ws(' ',name,report,id) ILIKE $1 LIMIT 4",
          [searchPattern(q), actor.id, permittedReports(actor.roles)],
        )
      ).rows;
      for (const row of presets)
        results.push({
          id: row.id,
          title: row.name,
          summary: row.report,
          group: "Reports",
          href:
            "/admin/workspaces/reports?preset=" + encodeURIComponent(row.id),
        });
    }
    const groups = [...new Set(results.map((x) => x.group))];
    const buckets = groups.map((group) =>
      results.filter((x) => x.group === group),
    );
    const balanced: typeof results = [];
    for (let i = 0; i < 30; i++) {
      for (const bucket of buckets) {
        if (bucket[i]) balanced.push(bucket[i]);
        if (balanced.length === 30) break;
      }
      if (balanced.length === 30) break;
    }
    return { results: balanced };
  });
}
