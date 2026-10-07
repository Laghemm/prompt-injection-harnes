import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { Severity } from "../../types";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-border bg-panel ${className}`} {...props} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-muted">{title}</h3>
        {subtitle && <div className="text-xs text-muted/80 mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Button({ className = "", variant = "default", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost"; size?: "sm" | "md" }) {
  const variants = {
    default: "bg-panel border border-border hover:border-accent text-fg",
    primary: "bg-accent border border-accent text-white hover:brightness-110",
    ghost: "bg-transparent border border-transparent hover:bg-white/5 text-fg",
  };
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2" };
  return <button className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

const SEV_COLOR: Record<Severity, string> = { Critical: "text-critical border-critical/40 bg-critical/10", High: "text-high border-high/40 bg-high/10", Medium: "text-medium border-medium/40 bg-medium/10", Low: "text-low border-low/40 bg-low/10" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SEV_COLOR[severity]}`}>{severity}</span>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "accent" }) {
  const tones = { neutral: "border-border text-muted", success: "border-success/40 text-success bg-success/10", accent: "border-accent/40 text-accent bg-accent-soft" };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function ProgressBar({ pct, color = "rgb(var(--accent))" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="text-sm font-semibold text-fg mb-1">{title}</div>
      <div className="text-xs text-muted max-w-sm mb-4">{body}</div>
      {action}
    </div>
  );
}

export function ErrorState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-critical/30 bg-critical/5 px-5 py-4">
      <div className="text-sm font-semibold text-critical mb-1">{title}</div>
      {detail && <div className="text-xs text-muted font-mono whitespace-pre-wrap">{detail}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function scoreColor(score: number): string {
  if (score >= 90) return "rgb(var(--success))";
  if (score >= 75) return "rgb(var(--low))";
  if (score >= 60) return "rgb(var(--medium))";
  return "rgb(var(--critical))";
}

export function gradeOf(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
