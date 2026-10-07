import { ArrowRight, Shield } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, ProgressBar, SeverityBadge, Skeleton, gradeOf, scoreColor } from "../components/ui/primitives";

export default function Overview() {
  const campaigns = useFetch(() => api.campaigns(), []);
  const findings = useFetch(() => api.findings(), []);

  if (campaigns.loading) return <OverviewSkeleton />;
  if (campaigns.error) return <ErrorState title="Could not load campaigns" detail={campaigns.error} />;
  const list = campaigns.data ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        title="No security campaigns yet"
        body="Run discovery first to identify an assistant's attack surface, then start an adaptive campaign."
        action={
          <Link to="/campaigns/new">
            <Button variant="primary">Start Discovery</Button>
          </Link>
        }
      />
    );
  }

  const latest = list[0];
  // Everything below is scoped to the SAME assistant as `latest` — comparing scores or mixing
  // findings across different assistants would be misleading (e.g. a "from previous run" delta
  // that's actually comparing two unrelated assistants).
  const assistantCampaigns = list.filter((c) => c.assistant === latest.assistant);
  const previous = assistantCampaigns[1];
  const delta = previous ? latest.score - previous.score : 0;
  const assistantFindings = (findings.data ?? []).filter((f) => f.assistant === latest.assistant);
  const topFindings = assistantFindings.filter((f) => f.status === "confirmed").sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).slice(0, 3);
  const trend = [...assistantCampaigns].reverse().slice(-8).map((c, i) => ({ v: i + 1, score: c.score }));
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  for (const f of assistantFindings) if (f.status === "confirmed") counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{latest.assistant}</h1>
          <p className="text-sm text-muted capitalize">{latest.type} AI assistant · last campaign {timeAgo(latest.timestamp)}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/campaigns/new"><Button variant="primary">Run Security Test</Button></Link>
          <Link to="/reports"><Button>Export Report</Button></Link>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-8 flex-wrap">
          <div className="flex items-center gap-5">
            <ScoreRing score={latest.score} />
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted mb-1">SECURITY POSTURE</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{latest.score}</span>
                <span className="text-muted">/ 100</span>
                <Badge tone="accent">{gradeOf(latest.score)}</Badge>
              </div>
              {previous && (
                <div className={`text-xs mt-1 ${delta > 0 ? "text-success" : delta < 0 ? "text-critical" : "text-muted"}`}>
                  {delta > 0 ? "↑" : delta < 0 ? "↓" : "–"} {Math.abs(delta)} from previous run
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            {(["Critical", "High", "Medium", "Low"] as const).map((s) => (
              <div key={s} className="text-center">
                <div className="text-xl font-bold" style={{ color: `rgb(var(--${s.toLowerCase()}))` }}>{counts[s] ?? 0}</div>
                <div className="text-[11px] text-muted uppercase">{s}</div>
              </div>
            ))}
          </div>
          <Link to="/findings" className="ml-auto self-center">
            <Button size="sm">View Findings</Button>
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader title="ATTACK SURFACE" action={<Link to={`/assistants/${encodeURIComponent(latest.assistant)}`} className="text-xs text-accent flex items-center gap-1">View all <ArrowRight size={12} /></Link>} />
          <AttackSurfaceBody assistant={latest.assistant} />
        </Card>
        <Card>
          <CardHeader title="TOP FINDINGS" action={<Link to="/findings" className="text-xs text-accent flex items-center gap-1">View all <ArrowRight size={12} /></Link>} />
          <div className="px-5 pb-4 space-y-2">
            {topFindings.length === 0 && <div className="text-xs text-muted py-4">No confirmed findings in the latest campaign.</div>}
            {topFindings.map((f) => (
              <Link key={f.findingId} to={`/findings/${f.findingId}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:border-accent/50 transition-colors">
                <div>
                  <SeverityBadge severity={f.severity} />
                  <div className="text-sm font-medium mt-1">{f.objectiveName}</div>
                  <div className="text-[11px] text-muted">{f.assistantCapability ?? f.primitiveName}</div>
                </div>
                <ArrowRight size={14} className="text-muted" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="SECURITY TREND" subtitle="Score across recent campaigns for this assistant" />
        <div className="h-40 px-3 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <XAxis dataKey="v" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip contentStyle={{ background: "rgb(var(--panel))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="RECENT CAMPAIGNS" action={<Link to="/campaigns" className="text-xs text-accent flex items-center gap-1">View all <ArrowRight size={12} /></Link>} />
        <table className="w-full text-sm">
          <tbody>
            {list.slice(0, 5).map((c) => (
              <tr key={c.id} className="border-t border-border/60 hover:bg-white/[0.02]">
                <td className="px-5 py-2.5"><Link to={`/campaigns/${c.id}`} className="hover:text-accent">{new Date(c.timestamp).toLocaleDateString()}</Link></td>
                <td className="px-2 py-2.5 text-muted">{c.assistant}</td>
                <td className="px-2 py-2.5 font-semibold" style={{ color: scoreColor(c.score) }}>{c.score}</td>
                <td className="px-2 py-2.5 text-muted">{c.findingsCount} findings</td>
                <td className="px-5 py-2.5 text-right"><Badge tone="success">Complete</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AttackSurfaceBody({ assistant }: { assistant: string }) {
  const { data, loading } = useFetch(() => api.assistant(assistant), [assistant]);
  if (loading || !data) return <div className="px-5 pb-4"><Skeleton className="h-24" /></div>;
  const p = data.profile;
  const stats = [
    ["Capabilities discovered", p.capabilities.length],
    ["High-impact capabilities", p.capabilities.filter((c) => c.impact === "high").length],
    ["Sensitive data classes", p.dataClasses.length],
    ["Tools", p.tools.length],
  ] as const;
  return (
    <div className="px-5 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className="font-semibold">{value}</span></div>
        ))}
      </div>
      {p.capabilities.length > 0 && (
        <div className="space-y-1 pt-1">
          {p.capabilities.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${c.impact === "high" ? "bg-critical" : c.impact === "medium" ? "bg-medium" : "bg-low"}`} />
              <span className="text-muted">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="9" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Shield size={18} style={{ color }} />
      </div>
    </div>
  );
}

function sevRank(s: string) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[s] ?? 4;
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32" />
      <div className="grid grid-cols-2 gap-5">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
