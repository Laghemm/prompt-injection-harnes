import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api, type CampaignJob } from "../lib/api";
import { Card, ErrorState } from "../components/ui/primitives";

const trunc = (s: string, n = 260) => {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? `${oneLine.slice(0, n)}…` : oneLine;
};

const VERDICT_STYLE: Record<string, string> = {
  failed: "text-critical border-critical/30 bg-critical/5",
  uncertain: "text-medium border-medium/30 bg-medium/5",
  held: "text-success border-success/30 bg-success/5",
  info: "text-accent border-accent/30 bg-accent-soft",
};

/** Polling-based live view (WebSocket would be the real-time upgrade; this is the documented fallback). */
export default function CampaignRun() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<CampaignJob>();
  const logEndRef = useRef<HTMLDivElement>(null);
  const seenCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await api.campaignJob(jobId);
        if (cancelled) return;
        setJob(j);
        if (j.state === "running") setTimeout(tick, 1000);
      } catch {
        if (!cancelled) setTimeout(tick, 1500);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (job && job.log.length > seenCount.current) {
      seenCount.current = job.log.length;
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [job?.log.length]);

  if (job?.state === "done" && job.campaignId) return <Navigate to={`/campaigns/${job.campaignId}`} replace />;

  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold">Campaign Running</h1>
      <Card className="p-5 space-y-4">
        {job?.state === "error" ? (
          <ErrorState title="Campaign failed" detail={job.error} />
        ) : (
          <>
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{job?.phase === "discover" ? "Discovering capabilities" : "Testing"}</span>
                <span>{job?.total ? `${job.done} / ${job.total}` : "Starting..."}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg p-3 h-[28rem] overflow-y-auto font-mono text-xs space-y-3">
              {!job?.log.length && (
                <div className="text-muted">
                  {job?.phase === "discover" ? "Sending safe recon questions to the assistant..." : "Waiting for the first attack to complete..."}
                </div>
              )}
              {job?.log.map((entry) => (
                <div key={entry.n} className={`rounded-md border p-2.5 ${VERDICT_STYLE[entry.verdict] ?? "border-border"}`}>
                  <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-wide mb-1.5">
                    <span className="text-fg">
                      [{entry.n}] {entry.objectiveName} — {entry.primitiveName} ({entry.strategy})
                    </span>
                    <span>{entry.verdict === "info" ? "recon" : `${entry.verdict} · ${Math.round(entry.confidence * 100)}%`}</span>
                  </div>
                  {entry.turns.map((t, i) => (
                    <div key={i} className="space-y-0.5 mb-1">
                      <div className="text-muted">→ {entry.turns.length > 1 ? `turn ${i + 1}` : "prompt"}: {trunc(t.prompt)}</div>
                      <div className="text-fg/80">← response: {trunc(t.response || "(empty)")}</div>
                      {t.toolCalls.length > 0 && <div className="text-critical">← tool calls: {trunc(JSON.stringify(t.toolCalls))}</div>}
                    </div>
                  ))}
                  <div className="font-sans text-[11px] text-muted mt-1">{entry.reason}</div>
                </div>
              ))}
              {job?.state === "running" && <div className="text-accent animate-pulse">● running...</div>}
              <div ref={logEndRef} />
            </div>
          </>
        )}
      </Card>
      <p className="text-xs text-muted">This can take a few minutes, especially with a cloud judge enabled. You can leave this page — the campaign keeps running.</p>
    </div>
  );
}
