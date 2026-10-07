import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton } from "../components/ui/primitives";

/**
 * Regression tracking across runs over time isn't persisted yet (no regression history store) —
 * this page lists confirmed findings so you can replay any of them from its detail page, which IS
 * the real, working regression check. A dedicated pass/fail history is a documented next step.
 */
export default function Regressions() {
  const { data, loading, error } = useFetch(() => api.findings(), []);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState title="Could not load findings" detail={error} />;
  const confirmed = (data ?? []).filter((f) => f.status === "confirmed");

  if (confirmed.length === 0) {
    return <EmptyState title="No confirmed findings to track" body="Once a campaign confirms a finding, you can replay it here any time to verify a fix." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Regressions</h1>
        <p className="text-sm text-muted">Replay a confirmed finding's exact steps any time to verify whether a fix still holds.</p>
      </div>
      <Card>
        <CardHeader title={`CONFIRMED FINDINGS (${confirmed.length})`} />
        <div className="px-5 pb-5 space-y-2">
          {confirmed.map((f) => (
            <Link key={f.findingId} to={`/findings/${f.findingId}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:border-accent/50">
              <div>
                <div className="text-sm font-medium">{f.objectiveName}</div>
                <div className="text-[11px] text-muted">{f.assistant} · {f.primitiveName}</div>
              </div>
              <Badge tone="accent">Replay →</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
