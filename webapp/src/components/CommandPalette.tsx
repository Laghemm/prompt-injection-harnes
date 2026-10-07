import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Cmd { label: string; to: string; hint?: string }

const COMMANDS: Cmd[] = [
  { label: "Overview", to: "/" },
  { label: "Assistants", to: "/assistants" },
  { label: "Campaigns", to: "/campaigns" },
  { label: "Start a new campaign", to: "/campaigns/new", hint: "Run discovery + adaptive attacks" },
  { label: "Findings", to: "/findings" },
  { label: "Open critical findings", to: "/findings?severity=Critical" },
  { label: "Attack Lab", to: "/attack-lab" },
  { label: "Coverage", to: "/coverage" },
  { label: "Regressions", to: "/regressions" },
  { label: "Reports", to: "/reports" },
  { label: "Settings", to: "/settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(term));
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-28" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Run security campaign, open findings, replay..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted"
          />
          <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <div className="px-4 py-6 text-center text-xs text-muted">No matches.</div>}
          {results.map((c) => (
            <button
              key={c.to + c.label}
              onClick={() => {
                navigate(c.to);
                setOpen(false);
                setQ("");
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex items-center justify-between"
            >
              <span>{c.label}</span>
              {c.hint && <span className="text-[11px] text-muted">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
