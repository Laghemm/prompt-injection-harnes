import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, CardHeader, ErrorState, Skeleton } from "../components/ui/primitives";

export default function AssistantDetail() {
  const { name = "" } = useParams();
  const { data, loading, error } = useFetch(() => api.assistant(name), [name]);

  if (loading) return <Skeleton className="h-64" />;
  if (error || !data) return <ErrorState title="Could not load assistant" detail={error} />;
  const p = data.profile;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">{p.name} <span className="w-2 h-2 rounded-full bg-success" /></h1>
          <div className="text-sm text-muted capitalize">{p.type} / Transactional</div>
        </div>
        <div className="flex gap-2">
          <Link to="/campaigns/new"><Button variant="primary">Run Campaign</Button></Link>
          <Link to={`/campaigns/${data.lastCampaignId}`}><Button>View Last Campaign</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader title="ASSISTANT PROFILE" />
          <div className="px-5 pb-4 space-y-2 text-sm">
            <Row label="Conversation" value={p.risk.multiTurn ? "Multi-turn supported" : "Single-turn"} />
            <Row label="External actions" value={p.risk.externalActions ? "Yes" : "No"} />
            <Row label="Sensitive data" value={p.dataClasses.join(", ") || "None detected"} />
            <Row label="Financial impact" value={p.risk.financialImpact} />
          </div>
          {p.unknown.length > 0 && (
            <div className="px-5 pb-4">
              <div className="text-[11px] font-semibold text-muted uppercase mb-1">Unclassified behavior</div>
              {p.unknown.map((u, i) => <div key={i} className="text-xs text-muted">· {u}</div>)}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="CAPABILITIES" subtitle={`${p.capabilities.length} discovered`} />
          <div className="px-5 pb-4 space-y-2">
            {p.capabilities.length === 0 && <div className="text-xs text-muted">No specific capabilities classified — discovery used keyword heuristics (no LLM provider) or the transcript was ambiguous.</div>}
            {p.capabilities.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  {c.description && <div className="text-[11px] text-muted">{c.description}</div>}
                </div>
                <Badge tone={c.impact === "high" ? "neutral" : "neutral"}>{c.impact}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="DISCOVERY TRANSCRIPT" subtitle="The safe recon questions used to build this profile" />
        <div className="px-5 pb-4 space-y-3">
          {p.transcript.map((t, i) => (
            <div key={i} className="text-sm">
              <div className="text-muted text-xs">Q: {t.question}</div>
              <div className="font-mono text-xs mt-0.5">{t.response}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
