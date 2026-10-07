import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, scoreColor } from "../components/ui/primitives";

const FILTERS = ["All", "Completed"] as const;

export default function Campaigns() {
  const { data, loading, error } = useFetch(() => api.campaigns(), []);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState title="Could not load campaigns" detail={error} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No security campaigns yet" body="Start a campaign to see history here." action={<Link to="/campaigns/new"><Button variant="primary">Start Campaign</Button></Link>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <Link to="/campaigns/new"><Button variant="primary">Run Security Test</Button></Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs rounded-full px-3 py-1 border ${filter === f ? "border-accent text-accent bg-accent-soft" : "border-border text-muted"}`}>
            {f}
          </button>
        ))}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted uppercase border-b border-border">
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-2 py-2.5 font-medium">Target</th>
              <th className="px-2 py-2.5 font-medium">Score</th>
              <th className="px-2 py-2.5 font-medium">Findings</th>
              <th className="px-5 py-2.5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-border/60 hover:bg-white/[0.02]">
                <td className="px-5 py-3"><Link to={`/campaigns/${c.id}`} className="hover:text-accent">{new Date(c.timestamp).toLocaleString()}</Link></td>
                <td className="px-2 py-3 text-muted">{c.assistant}</td>
                <td className="px-2 py-3 font-semibold" style={{ color: scoreColor(c.score) }}>{c.score}</td>
                <td className="px-2 py-3 text-muted">{c.findingsCount} ({c.criticalCount} critical)</td>
                <td className="px-5 py-3 text-right"><Badge tone="success">Complete</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
