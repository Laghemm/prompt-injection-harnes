import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type TargetFormInput } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Button, Card, ErrorState } from "../components/ui/primitives";
import { TargetPicker } from "../components/TargetPicker";

const STEPS = ["Target", "Provider & depth", "Start"] as const;

export default function CampaignWizard() {
  const navigate = useNavigate();
  const providers = useFetch(() => api.providers(), []);
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<TargetFormInput>({ mode: "demo", demoTarget: "weakBot" });
  const [provider, setProvider] = useState<"none" | "gemini" | "claude">("none");
  const [maxScenarios, setMaxScenarios] = useState(40);
  const [escalate, setEscalate] = useState(false);
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    setError(undefined);
    try {
      const { id } = await api.startCampaign({ ...target, provider, maxScenarios, escalate });
      navigate(`/campaigns/run/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start campaign");
      setStarting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold">New Security Campaign</h1>

      <div className="flex items-center gap-2 text-xs">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 ${i === step ? "text-accent" : i < step ? "text-success" : "text-muted"}`}>
            <span className={`w-5 h-5 rounded-full border grid place-content-center ${i === step ? "border-accent" : i < step ? "border-success" : "border-border"}`}>{i + 1}</span>
            {s}
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      <Card className="p-5">
        {step === 0 && (
          <>
            <h2 className="text-sm font-semibold mb-3">Which assistant should be tested?</h2>
            <TargetPicker value={target} onChange={setTarget} demoTargets={providers.data?.demoTargets ?? ["weakBot", "hardenedBot", "guardedBot"]} />
          </>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-2">Judge</h2>
              <div className="flex gap-2">
                {(["none", "gemini", "claude"] as const).map((p) => {
                  const available = p === "none" || (p === "gemini" ? providers.data?.gemini : providers.data?.claude);
                  return (
                    <button
                      key={p}
                      disabled={!available}
                      onClick={() => setProvider(p)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-40 ${provider === p ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"}`}
                    >
                      {p === "none" ? "Rules only" : p}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-1.5">Rules only keeps everything local. A cloud judge sends the assistant's responses to that provider.</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold mb-2">Max scenarios</h2>
              <input type="range" min={10} max={100} value={maxScenarios} onChange={(e) => setMaxScenarios(Number(e.target.value))} className="w-full accent-accent" />
              <div className="text-xs text-muted">{maxScenarios} scenarios planned (relevance-ranked, highest first)</div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />
              Escalate: try a second attack strategy per objective if the first one holds
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Ready to start</h2>
            <div className="text-sm text-muted space-y-1">
              <div>Target: <span className="text-fg font-medium">{target.mode === "demo" ? target.demoTarget : target.url || "(not set)"}</span></div>
              <div>Judge: <span className="text-fg font-medium">{provider === "none" ? "Rules only" : provider}</span></div>
              <div>Up to <span className="text-fg font-medium">{maxScenarios}</span> adaptive scenarios, generated from the assistant's discovered capabilities.</div>
            </div>
            {error && <ErrorState title="Could not start" detail={error} />}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={target.mode === "http" && !target.url}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={start} disabled={starting}>
              {starting ? "Starting..." : "Start Campaign"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
