import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "../components/ui/primitives";

export default function Reports() {
  const { data, loading, error } = useFetch(() => api.campaigns(), []);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState title="Could not load reports" detail={error} />;
  if (!data || data.length === 0) return <EmptyState title="No reports yet" body="Every campaign automatically produces a Markdown and JSON report." />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted">Each campaign produces a Markdown report (human-readable) and a JSON report (full raw data).</p>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted uppercase border-b border-border">
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-2 py-2.5 font-medium">Assistant</th>
              <th className="px-2 py-2.5 font-medium">Score</th>
              <th className="px-5 py-2.5 font-medium text-right">Export</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="px-5 py-3">{new Date(c.timestamp).toLocaleString()}</td>
                <td className="px-2 py-3 text-muted">{c.assistant}</td>
                <td className="px-2 py-3">{c.score}</td>
                <td className="px-5 py-3 text-right space-x-2">
                  <a href={`/api/v2/campaigns/${c.id}/download?format=md`} target="_blank" rel="noreferrer"><Button size="sm">Markdown</Button></a>
                  <a href={`/api/v2/campaigns/${c.id}/download?format=json`} target="_blank" rel="noreferrer"><Button size="sm">JSON</Button></a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted">Executive/Technical/Developer report templates and PDF export aren't built yet — Markdown and JSON cover the same underlying data.</p>
    </div>
  );
}
