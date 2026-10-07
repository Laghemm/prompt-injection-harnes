import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, scoreColor } from "../components/ui/primitives";

export default function Assistants() {
  const { data, loading, error } = useFetch(() => api.assistants(), []);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState title="Could not load assistants" detail={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No assistants tested yet"
        body="Run discovery or a campaign against an assistant and it will show up here."
        action={<Link to="/campaigns/new"><Button variant="primary">Start Discovery</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assistants</h1>
        <Link to="/campaigns/new"><Button variant="primary">Add Assistant</Button></Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {data.map((a) => (
          <Link key={a.assistant} to={`/assistants/${encodeURIComponent(a.assistant)}`}>
            <Card className="p-4 hover:border-accent/50 transition-colors h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{a.assistant}</div>
                <span className="w-2 h-2 rounded-full bg-success" title="Connected" />
              </div>
              <div className="text-xs text-muted capitalize mb-3">{a.type} assistant</div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold" style={{ color: scoreColor(a.score) }}>{a.score}</span>
                <div className="flex gap-1.5">
                  {a.criticalCount > 0 && <Badge tone="neutral">{a.criticalCount} critical</Badge>}
                  <Badge tone="neutral">{a.findingsCount} findings</Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
