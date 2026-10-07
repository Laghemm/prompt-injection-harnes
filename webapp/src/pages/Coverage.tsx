import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Card, CardHeader, EmptyState, ErrorState, ProgressBar, Skeleton } from "../components/ui/primitives";

export default function Coverage() {
  const campaigns = useFetch(() => api.campaigns(), []);
  const latestId = campaigns.data?.[0]?.id;
  const { data, loading, error } = useFetch(() => (latestId ? api.campaign(latestId) : Promise.reject(new Error("no campaign"))), [latestId]);

  if (campaigns.loading || loading) return <Skeleton className="h-64" />;
  if (!campaigns.data || campaigns.data.length === 0) {
    return <EmptyState title="No coverage data yet" body="Run a campaign to see how much of the attack surface was tested." action={<Link to="/campaigns/new" className="text-accent text-sm">Start a campaign →</Link>} />;
  }
  if (error || !data) return <ErrorState title="Could not load coverage" detail={error} />;

  const c = data.coverage;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Attack-Surface Coverage</h1>
        <p className="text-sm text-muted">For {data.assistant}, latest campaign ({new Date(data.timestamp).toLocaleDateString()})</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Capabilities" value={c.capabilitiesDiscovered} />
        <Stat label="Objectives considered" value={c.objectivesConsidered} />
        <Stat label="Objectives tested" value={c.objectivesTested} />
        <Stat label="Scenarios executed" value={data.executed.length} />
      </div>

      <Card>
        <CardHeader title="COVERAGE BY SECURITY OBJECTIVE" />
        <div className="px-5 pb-5 space-y-3">
          {Object.entries(c.byObjective).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span>{k}</span>
                <span className="text-muted">{v.tested}/{v.planned} ({v.pct}%)</span>
              </div>
              <ProgressBar pct={v.pct} />
            </div>
          ))}
        </div>
      </Card>

      {data.profile.unknown.length > 0 && (
        <Card>
          <CardHeader title="UNTESTED / UNKNOWN" subtitle="Candidates for more probing" />
          <div className="px-5 pb-4 space-y-1">
            {data.profile.unknown.map((u, i) => <div key={i} className="text-xs text-muted">○ {u}</div>)}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
