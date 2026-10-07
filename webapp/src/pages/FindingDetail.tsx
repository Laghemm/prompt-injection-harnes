import { useState } from "react";
import { useParams } from "react-router-dom";
import { api, type TargetFormInput } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, CardHeader, ErrorState, SeverityBadge, Skeleton } from "../components/ui/primitives";
import { TargetPicker } from "../components/TargetPicker";

const TABS = ["Conversation", "Evidence", "Reproduction", "Remediation"] as const;

export default function FindingDetail() {
  const { id = "" } = useParams();
  const { data, loading, error } = useFetch(() => api.finding(id), [id]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Conversation");

  if (loading) return <Skeleton className="h-64" />;
  if (error || !data) return <ErrorState title="Could not load finding" detail={error} />;

  return (
    <div className="space-y-5">
      <div>
        <SeverityBadge severity={data.severity} />
        <h1 className="text-xl font-semibold mt-2">{data.objectiveName}</h1>
        <div className="text-sm text-muted mt-1 flex items-center gap-3">
          <Badge tone={data.status === "confirmed" ? "neutral" : "accent"}>{data.status === "confirmed" ? "Confirmed" : "Needs review"}</Badge>
          <span>Confidence: {Math.round(data.confidence * 100)}%</span>
          <span>First seen: {new Date(data.discoveredAt).toLocaleDateString()}</span>
        </div>
      </div>

      <Card className="p-5">
        <div className="text-xs font-semibold text-muted mb-1">WHY IT MATTERS</div>
        <p className="text-sm">{data.reason}</p>
      </Card>

      <Card className="p-5">
        <div className="text-xs font-semibold text-muted mb-3">ATTACK PATH</div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {["User", data.primitiveName, data.attackStrategy, data.objectiveName, data.assistantCapability ?? "Assistant", "Outcome"].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <span className="rounded-lg border border-border bg-bg px-2.5 py-1.5">{step}</span>
              {i < arr.length - 1 && <span className="text-muted">→</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex border-b border-border px-5 pt-3 gap-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-medium pb-2.5 border-b-2 -mb-px ${tab === t ? "border-accent text-accent" : "border-transparent text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "Conversation" && (
            <div className="space-y-4">
              {data.conversation.map((t, i) => (
                <div key={i} className="space-y-2">
                  <div>
                    <div className="text-[11px] font-semibold text-accent uppercase mb-1">Turn {i + 1} — User</div>
                    <pre className="font-mono text-xs bg-bg border border-border rounded-lg p-3 whitespace-pre-wrap">{t.prompt}</pre>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-muted uppercase mb-1">Assistant</div>
                    <pre className="font-mono text-xs bg-bg border border-border rounded-lg p-3 whitespace-pre-wrap">{t.response || "(empty response)"}</pre>
                  </div>
                  {t.toolCalls.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-critical uppercase mb-1">Tool calls</div>
                      <pre className="font-mono text-xs bg-critical/5 border border-critical/30 rounded-lg p-3 whitespace-pre-wrap">{JSON.stringify(t.toolCalls, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === "Evidence" && (
            <div className="space-y-2">
              {data.evidence.length === 0 && <div className="text-xs text-muted">No structured evidence recorded.</div>}
              {data.evidence.map((e, i) => (
                <div key={i} className="font-mono text-xs bg-bg border border-border rounded-lg p-3">
                  <span className="text-accent">{e.type}</span> — {e.detail}
                </div>
              ))}
            </div>
          )}
          {tab === "Reproduction" && <ReproductionPanel findingId={data.findingId} />}
          {tab === "Remediation" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted uppercase">Recommended fix</div>
              <p className="text-sm">{data.fixHint}</p>
              <p className="text-xs text-muted">A prompt-only instruction is not sufficient protection for a high-impact operation — enforce the control in code.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ReproductionPanel({ findingId }: { findingId: string }) {
  const [target, setTarget] = useState<TargetFormInput>({ mode: "demo", demoTarget: "weakBot" });
  const providers = useFetch(() => api.providers(), []);
  const [result, setResult] = useState<{ newVerdict: string; fixed: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();

  async function replay() {
    setRunning(true);
    setError(undefined);
    setResult(null);
    try {
      const r = await api.replay(findingId, target);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Re-run this finding's exact steps against a live assistant to check if a fix worked.</p>
      <TargetPicker value={target} onChange={setTarget} demoTargets={providers.data?.demoTargets ?? ["weakBot", "hardenedBot", "guardedBot"]} />
      <Button variant="primary" onClick={replay} disabled={running}>{running ? "Replaying..." : "Replay Attack"}</Button>
      {error && <ErrorState title="Replay failed" detail={error} />}
      {result && (
        <div className={`rounded-lg border px-3 py-2.5 text-sm ${result.fixed ? "border-success/40 bg-success/10 text-success" : "border-critical/40 bg-critical/10 text-critical"}`}>
          {result.fixed ? "✓ No longer reproduces — looks fixed." : "✗ Still reproduces — NOT fixed."} (verdict: {result.newVerdict})
        </div>
      )}
    </div>
  );
}
