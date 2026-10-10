"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import {
  reportDefinitions,
  type ReportName,
  type ReportFilters,
} from "@/domain/reports";
type Preset = {
  id: string;
  name: string;
  visibility: string;
  report: ReportName;
  filters: ReportFilters;
  version: number;
  owned: boolean;
};
type Result = {
  rows: Record<string, unknown>[];
  columns: string[];
  range: { from: string | null; to: string | null };
  previewLimited: boolean;
  filters: ReportFilters;
};
const initial: ReportFilters = {
  period: "all",
  from: null,
  to: null,
  q: "",
  verification: "all",
  review: "all",
  contact: "all",
};
const periodLabels = {
  all: "All dates",
  last30: "Last 30 days",
  month: "This month",
  previous: "Previous month",
  financial: "Current Indian financial year",
  custom: "Custom dates",
};
function params(report: ReportName, filters: ReportFilters) {
  return new URLSearchParams({
    report,
    ...Object.fromEntries(
      Object.entries(filters).map(([k, v]) => [k, v ?? ""]),
    ),
  });
}
export function OperationsReports() {
  const [available, setAvailable] = useState<ReportName[]>([]),
    [report, setReport] = useState<ReportName>("events"),
    [filters, setFilters] = useState(initial),
    [result, setResult] = useState<Result>(),
    [applied, setApplied] = useState<{
      report: ReportName;
      filters: ReportFilters;
    }>(),
    [presets, setPresets] = useState<Preset[]>([]),
    [admin, setAdmin] = useState(false),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [visibility, setVisibility] = useState("private"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("Loading reports…");
  const preset = presets.find((p) => p.id === selected),
    manageable =
      !!preset && (preset.visibility === "shared" ? admin : preset.owned);
  async function reloadPresets() {
    const data = await api<{ presets: Preset[]; administrator: boolean }>(
      "/api/staff/report-presets",
    );
    setPresets(data.presets);
    setAdmin(data.administrator);
  }
  async function load(r = report, f = filters) {
    setBusy(true);
    setMessage("Loading report…");
    try {
      const data = await api<Result>(`/api/staff/reports?${params(r, f)}`);
      setResult(data);
      setApplied({
        report: r,
        filters: { ...f, period: "custom", ...data.range },
      });
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ available: ReportName[] }>("/api/staff/reports?catalog=true"),
      api<{ presets: Preset[]; administrator: boolean }>(
        "/api/staff/report-presets",
      ),
    ])
      .then(async ([catalog, saved]) => {
        if (!active) return;
        setAvailable(catalog.available);
        setPresets(saved.presets);
        setAdmin(saved.administrator);
        if (catalog.available.length) {
          const presetId = new URLSearchParams(location.search).get("preset");
          const chosen = saved.presets.find((p) => p.id === presetId);
          const r = chosen?.report ?? catalog.available[0];
          const activeFilters = chosen?.filters ?? initial;
          if (chosen) {
            setSelected(chosen.id);
            setName(chosen.name);
            setVisibility(chosen.visibility);
            setFilters(chosen.filters);
          }
          setReport(r);
          const data = await api<Result>(
            `/api/staff/reports?${params(r, activeFilters)}`,
          );
          if (active) {
            setResult(data);
            setApplied({
              report: r,
              filters: { ...activeFilters, period: "custom", ...data.range },
            });
            setMessage("");
          }
        } else
          setMessage(
            "Your role has no report datasets. Financial reports await verified payment workflows.",
          );
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (key: keyof ReportFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  async function save(remove = false) {
    setBusy(true);
    try {
      await api("/api/staff/report-presets", {
        action: remove ? "delete" : "save",
        ...(selected ? { id: selected } : {}),
        version: preset?.version ?? 0,
        name,
        visibility,
        report,
        filters,
      });
      await reloadPresets();
      setSelected("");
      setName("");
      setMessage(
        remove
          ? "Preset deleted."
          : "Preset saved. Results are never stored in presets.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(format: "csv" | "xlsx") {
    if (!applied) return;
    setBusy(true);
    setMessage(`Preparing ${format.toUpperCase()}…`);
    try {
      const response = await fetch(
        `/api/staff/reports/export?${params(applied.report, applied.filters)}&format=${format}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error((await response.json()).error ?? "Export failed.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `tpa-${applied.report}-report.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${format.toUpperCase()} download ready.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Reports use your current permissions. Accounts are not approved
        memberships; attendance is recorded check-ins, not accredited learning
        hours.
      </p>
      <form
        className="member-settings"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <fieldset
          className="plain-fieldset"
          disabled={busy || !available.length}
        >
          <legend>Report and filters</legend>
          <label>
            Report
            <select
              value={report}
              onChange={(e) => setReport(e.target.value as ReportName)}
            >
              {available.map((r) => (
                <option key={r} value={r}>
                  {reportDefinitions[r].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reporting period
            <select
              value={filters.period}
              onChange={(e) => update("period", e.target.value)}
            >
              {Object.entries(periodLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {filters.period === "custom" && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(e) => update("from", e.target.value)}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(e) => update("to", e.target.value)}
                />
              </label>
            </>
          )}
          {report === "accounts" && (
            <>
              <label>
                Directory search
                <input
                  value={filters.q}
                  maxLength={120}
                  onChange={(e) => update("q", e.target.value)}
                  placeholder="Name, email, organization or city"
                />
              </label>
              {(
                [
                  [
                    "verification",
                    "Email verification",
                    ["all", "verified", "unverified"],
                  ],
                  [
                    "review",
                    "Profile review",
                    ["all", "unverified", "pending", "verified", "rejected"],
                  ],
                  [
                    "contact",
                    "Contact availability",
                    ["all", "phone", "no-phone"],
                  ],
                ] as const
              ).map(([key, label, choices]) => (
                <label key={key}>
                  {label}
                  <select
                    value={filters[key]}
                    onChange={(e) => update(key, e.target.value)}
                  >
                    {choices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </>
          )}
          <button className="button" type="submit">
            Apply filters
          </button>
        </fieldset>
      </form>
      <section className="content-section">
        <h2>Saved report presets</h2>
        <p>
          Private presets belong to you. Administrators maintain shared presets.
          Relative periods resolve in India time when applied.
        </p>
        <div className="member-settings">
          <label>
            Preset
            <select
              value={selected}
              disabled={busy}
              onChange={(e) => {
                const p = presets.find((p) => p.id === e.target.value);
                setSelected(e.target.value);
                setName(p?.name ?? "");
                setVisibility(p?.visibility ?? "private");
                if (p) {
                  setReport(p.report);
                  setFilters(p.filters);
                }
              }}
            >
              <option value="">New preset</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.visibility}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row">
            <button
              className="button secondary"
              disabled={busy || !preset}
              onClick={() => {
                if (preset) void load(preset.report, preset.filters);
              }}
            >
              Apply preset
            </button>
            <button
              className="button secondary"
              disabled={busy || !preset}
              onClick={() => {
                setSelected("");
                setVisibility("private");
                setName(preset ? `${preset.name} copy` : "");
              }}
            >
              Make private copy
            </button>
          </div>
          <label>
            Preset name
            <input
              value={name}
              maxLength={120}
              disabled={busy || (!!preset && !manageable)}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Visibility
            <select
              value={visibility}
              disabled={busy || !!preset}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="private">Private</option>
              {admin && <option value="shared">Shared</option>}
            </select>
          </label>
          <div className="action-row">
            <button
              className="button"
              disabled={
                busy ||
                !available.length ||
                !name.trim() ||
                (!!preset && !manageable)
              }
              onClick={() => void save()}
            >
              Save preset
            </button>
            <button
              className="button secondary"
              disabled={busy || !manageable}
              onClick={() => {
                if (confirm("Delete this preset?")) void save(true);
              }}
            >
              Delete preset
            </button>
          </div>
        </div>
      </section>
      {result && applied && (
        <section className="content-section">
          <div className="action-row">
            <h2>{reportDefinitions[applied.report].label}</h2>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void download("csv")}
            >
              Export CSV
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void download("xlsx")}
            >
              Export XLSX
            </button>
          </div>
          <p>{reportDefinitions[applied.report].meaning}</p>
          <p>
            Applied dates: {result.range.from ?? "All dates"} through{" "}
            {result.range.to ?? "no end date"} · India time.{" "}
            {result.rows.length} preview rows
            {result.previewLimited ? " (first 200)" : ""}. Downloads include all
            matching rows up to 10,000; larger exports require narrower filters.
          </p>
          {!result.rows.length ? (
            <p>No matching records. Empty exports include column headers.</p>
          ) : (
            <div className="table-scroll">
              <table className="operations-table">
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} scope="col">
                        {c.replaceAll("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {result.columns.map((c) => (
                        <td key={c}>{String(row[c] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
