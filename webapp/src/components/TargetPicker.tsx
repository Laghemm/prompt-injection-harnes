import { useEffect, useState } from "react";
import type { TargetFormInput } from "../lib/api";

interface Props {
  value: TargetFormInput;
  onChange: (v: TargetFormInput) => void;
  demoTargets: string[];
}

const DEFAULT_BODY = '{"message": "{{prompt}}"}';
const DEFAULT_RESPONSE_PATH = "reply";

/** The same URL/body/headers form the vanilla dashboard has, reused here for the new UI. */
export function TargetPicker({ value, onChange, demoTargets }: Props) {
  const [remoteAck, setRemoteAck] = useState(false);
  const isRemote = value.mode === "http" && value.url ? !/localhost|127\.0\.0\.1/.test(value.url) : false;

  // The body/responsePath fields SHOW a default value, but that default must actually be written
  // into the form state — otherwise "Start Campaign" fails with "body/responsePath required" even
  // though the box looked filled in, because the user never touched it to trigger onChange.
  useEffect(() => {
    if (value.mode === "http" && (value.body === undefined || value.responsePath === undefined)) {
      onChange({ ...value, body: value.body ?? DEFAULT_BODY, responsePath: value.responsePath ?? DEFAULT_RESPONSE_PATH });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["demo", "http"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ ...value, mode: m, ...(m === "http" ? { body: value.body ?? DEFAULT_BODY, responsePath: value.responsePath ?? DEFAULT_RESPONSE_PATH } : {}) })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              value.mode === m ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:border-accent/50"
            }`}
          >
            {m === "demo" ? "Built-in practice bot" : "My own assistant"}
          </button>
        ))}
      </div>

      {value.mode === "demo" ? (
        <label className="block text-xs font-medium text-muted">
          Demo bot
          <select
            value={value.demoTarget ?? demoTargets[0]}
            onChange={(e) => onChange({ ...value, demoTarget: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
          >
            {demoTargets.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted">
            Assistant URL
            <input
              value={value.url ?? ""}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              placeholder="http://localhost:8787/chat"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono"
            />
          </label>
          {isRemote && (
            <div className="rounded-lg border border-medium/40 bg-medium/5 px-3 py-2 text-xs text-medium">
              Not a localhost address. Only test systems you own or have written permission to test.
              <label className="flex items-center gap-2 mt-1.5 font-medium">
                <input type="checkbox" checked={remoteAck} onChange={(e) => { setRemoteAck(e.target.checked); onChange({ ...value, allowRemote: e.target.checked }); }} />
                I own this system or have written permission to test it
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-muted">
              Auth header name <span className="text-muted/60">(optional)</span>
              <input
                value={value.headers?.[0]?.name ?? ""}
                onChange={(e) => onChange({ ...value, headers: [{ name: e.target.value, value: value.headers?.[0]?.value ?? "" }] })}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono"
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Auth header value <span className="text-muted/60">(optional)</span>
              <input
                type="password"
                value={value.headers?.[0]?.value ?? ""}
                onChange={(e) => onChange({ ...value, headers: [{ name: value.headers?.[0]?.name ?? "", value: e.target.value }] })}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted">
            Request body template
            <textarea
              value={value.body ?? '{"message": "{{prompt}}"}'}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono"
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Reply path
            <input
              value={value.responsePath ?? "reply"}
              onChange={(e) => onChange({ ...value, responsePath: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono"
            />
          </label>
        </div>
      )}
    </div>
  );
}
