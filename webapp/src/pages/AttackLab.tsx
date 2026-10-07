import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Button, Card, CardHeader, ErrorState, Skeleton } from "../components/ui/primitives";

interface Scenario { id: string; primitiveName: string; strategy: string; turns: string[]; fixHint: string }

export default function AttackLab() {
  const { data, loading, error } = useFetch(() => fetchLab(), []);
  const [objectiveId, setObjectiveId] = useState<string>();
  const [capability, setCapability] = useState("cancel_booking");
  const [assistantType, setAssistantType] = useState("booking");
  const [preview, setPreview] = useState<Scenario[]>();
  const [previewing, setPreviewing] = useState(false);

  async function generate() {
    if (!objectiveId) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/v2/attack-lab/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectiveId, capability, assistantType }) });
      setPreview(await res.json());
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;
  if (error || !data) return <ErrorState title="Could not load the attack library" detail={error} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Attack Lab</h1>
        <p className="text-sm text-muted">Generate adaptive security scenarios from a security objective and a target capability.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs font-medium text-muted">
            Security objective
            <select value={objectiveId ?? ""} onChange={(e) => setObjectiveId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg">
              <option value="" disabled>Select an objective</option>
              {data.objectives.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Target capability
            <input value={capability} onChange={(e) => setCapability(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg" />
          </label>
          <label className="text-xs font-medium text-muted">
            Assistant type
            <input value={assistantType} onChange={(e) => setAssistantType(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg" />
          </label>
        </div>
        <Button variant="primary" onClick={generate} disabled={!objectiveId || previewing}>{previewing ? "Generating..." : "Generate"}</Button>
      </Card>

      {preview && (
        <Card>
          <CardHeader title={`GENERATED SCENARIOS (${preview.length})`} />
          <div className="px-5 pb-5 space-y-3">
            {preview.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.primitiveName}</span>
                  <Badge tone="accent">{s.strategy}</Badge>
                </div>
                {s.turns.map((t, i) => <pre key={i} className="font-mono text-xs bg-bg border border-border rounded-lg p-2.5 mt-1.5 whitespace-pre-wrap">{t}</pre>)}
                <div className="text-[11px] text-muted mt-1.5">Fix: {s.fixHint}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="PRIMITIVE LIBRARY" subtitle={`${data.primitives.length} reusable attack building blocks`} />
        <div className="px-5 pb-5 grid grid-cols-2 gap-2">
          {data.primitives.map((p) => (
            <div key={p.id} className="rounded-lg border border-border px-3 py-2">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-muted">{p.description}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

async function fetchLab() {
  const res = await fetch("/api/v2/attack-lab");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<{ objectives: { id: string; name: string; description: string; severity: string }[]; primitives: { id: string; name: string; description: string }[] }>;
}
