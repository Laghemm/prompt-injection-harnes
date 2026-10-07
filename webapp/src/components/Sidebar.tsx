import { Activity, Bot, FileText, FlaskConical, GitBranch, LayoutGrid, Settings, Shield, Target } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/assistants", label: "Assistants", icon: Bot },
  { to: "/campaigns", label: "Campaigns", icon: Activity },
  { to: "/findings", label: "Findings", icon: Shield },
  { to: "/attack-lab", label: "Attack Lab", icon: FlaskConical },
  { to: "/coverage", label: "Coverage", icon: Target },
  { to: "/regressions", label: "Regressions", icon: GitBranch },
  { to: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-panel/60 flex flex-col">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <Shield size={18} className="text-accent" />
        <span className="font-semibold text-sm">AI Security</span>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-accent-soft text-accent font-medium" : "text-muted hover:bg-white/5 hover:text-fg"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-white/5 hover:text-fg"}`}>
          <Settings size={16} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
