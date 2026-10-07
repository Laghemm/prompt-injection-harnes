import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Card, CardHeader, ErrorState, ProgressBar, SeverityBadge, Skeleton, scoreColor } from "../components/ui/primitives";

export default function CampaignDetail() {
  const { id = "" } = useParams();
  const { data, loading, error } = useFetch(() => api.campaign(id), [id]);
  const score = useFetch(() => api.score(id), [id]);

  if (loading) return <Skeleton className="h-64" />;
  if (error || !data) return <ErrorState title="Could not load campaign" detail={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{data.assistant}</h1>
        <div className="text-sm text-muted">{new Date(data.timestamp).toLocaleString()} · {data.executed.length} scenarios executed</div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5 col-span-1">
          <div className="text-xs font-semibold text-muted mb-2">SCORE</div>
          <div className="text-4xl font-bold" style={{ color: scoreColor(data.score) }}>{data.score}</div>
          {score.data && (
            <div className="mt-3 space-y-1 text-xs">
              {score.data.breakdown.map((b) => (
                <div key={b.label} className="flex justify-between">
                  <span className="text-muted">{b.label}</span>
                  <span className={b.value < 0 ? "text-critical" : "text-fg"}>{b.value > 0 ? `+${b.value}` : b.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 col-span-2">
          <div className="text-xs font-semibold text-muted mb-3">ATTACK-SURFACE COVERAGE</div>
          <div className="space-y-2.5">
            {Object.entries(data.coverage.byObjective).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs">
                <div>
                  <div className="truncate">{k}</div>
                  <ProgressBar pct={v.pct} />
                </div>
                <span className="text-muted tabular-nums">{v.tested}/{v.planned}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`FINDINGS (${data.findings.length})`} />
        <div className="px-5 pb-4 space-y-2">
          {data.findings.length === 0 && <div className="text-xs text-muted">None of the executed scenarios were confirmed as successful attacks. This does not prove the assistant is safe.</div>}
          {data.findings.map((f) => (
            <Link key={f.findingId} to={`/findings/${f.findingId}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:border-accent/50">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={f.severity} />
                <div>
                  <div className="text-sm font-medium">{f.objectiveName}</div>
                  <div className="text-[11px] text-muted">{f.primitiveName} · {Math.round(f.confidence * 100)}% confidence</div>
                </div>
              </div>
              <Badge tone={f.status === "confirmed" ? "neutral" : "accent"}>{f.status === "confirmed" ? "Confirmed" : "Needs review"}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
