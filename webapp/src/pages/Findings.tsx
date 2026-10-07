import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Card, EmptyState, ErrorState, SeverityBadge, Skeleton } from "../components/ui/primitives";

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

export default function Findings() {
  const { data, loading, error } = useFetch(() => api.findings(), []);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const severity = params.get("severity") ?? "";
  const status = params.get("status") ?? "";

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (severity) list = list.filter((f) => f.severity === severity);
    if (status) list = list.filter((f) => f.status === status);
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter((f) => `${f.objectiveName} ${f.primitiveName} ${f.assistant}`.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  }, [data, severity, status, q]);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState title="Could not load findings" detail={error} />;
  if (!data || data.length === 0) return <EmptyState title="No findings yet" body="Run a campaign to start discovering vulnerabilities." />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Findings</h1>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search findings..."
          className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs w-56"
        />
        {["", "Critical", "High", "Medium", "Low"].map((s) => (
          <button key={s} onClick={() => setParams(s ? { severity: s } : {})} className={`text-xs rounded-full px-3 py-1 border ${severity === s ? "border-accent text-accent bg-accent-soft" : "border-border text-muted"}`}>
            {s || "All severities"}
          </button>
        ))}
        {["", "confirmed", "needs_review"].map((s) => (
          <button key={s} onClick={() => setParams(s ? { status: s } : {})} className={`text-xs rounded-full px-3 py-1 border ${status === s ? "border-accent text-accent bg-accent-soft" : "border-border text-muted"}`}>
            {s === "" ? "All statuses" : s === "confirmed" ? "Confirmed" : "Needs review"}
          </button>
        ))}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted uppercase border-b border-border">
              <th className="px-5 py-2.5 font-medium">Severity</th>
              <th className="px-2 py-2.5 font-medium">Finding</th>
              <th className="px-2 py-2.5 font-medium">Target</th>
              <th className="px-2 py-2.5 font-medium">Confidence</th>
              <th className="px-5 py-2.5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.findingId} className="border-t border-border/60 hover:bg-white/[0.02]">
                <td className="px-5 py-3"><SeverityBadge severity={f.severity} /></td>
                <td className="px-2 py-3"><Link to={`/findings/${f.findingId}`} className="hover:text-accent font-medium">{f.objectiveName}</Link></td>
                <td className="px-2 py-3 text-muted">{f.assistant}</td>
                <td className="px-2 py-3 text-muted">{Math.round(f.confidence * 100)}%</td>
                <td className="px-5 py-3 text-right"><Badge tone={f.status === "confirmed" ? "neutral" : "accent"}>{f.status === "confirmed" ? "Confirmed" : "Needs review"}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-muted">No findings match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
