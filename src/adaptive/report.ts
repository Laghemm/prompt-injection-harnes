import fs from "node:fs";
import path from "node:path";
import type { AdaptiveCampaignResult } from "./engine";

function toMarkdown(r: AdaptiveCampaignResult): string {
  const { profile, plan, findings, coverage } = r;
  const lines = [
    `# Adaptive security report: ${profile.name}`,
    "",
    `- Assistant type (auto-detected): **${profile.type}**`,
    `- Capabilities discovered: ${coverage.capabilitiesDiscovered}`,
    `- Data classes: ${profile.dataClasses.join(", ") || "none detected"}`,
    `- Tools: ${profile.tools.join(", ") || "none detected"}`,
    `- Risk: sensitive data = ${profile.risk.sensitiveData}, external actions = ${profile.risk.externalActions}, financial impact = ${profile.risk.financialImpact}`,
    `- Security objectives considered relevant: ${coverage.objectivesConsidered}`,
    `- Scenarios planned: ${plan.length} · executed: ${r.executed.length}`,
    `- **Confirmed findings: ${findings.filter((f) => f.status === "confirmed").length}** (+ ${findings.filter((f) => f.status === "needs_review").length} needing manual review)`,
    "",
    "## Attack-surface coverage",
    "",
    "| Objective | Planned | Tested | Coverage |",
    "|---|---|---|---|",
    ...Object.entries(coverage.byObjective).map(([k, v]) => `| ${k} | ${v.planned} | ${v.tested} | ${v.pct}% |`),
    "",
    "## Findings",
    "",
  ];
  if (findings.length === 0) lines.push("None of the executed scenarios were confirmed as successful attacks.");
  for (const f of findings.sort((a, b) => (a.severity > b.severity ? 1 : -1))) {
    lines.push(
      `### ${f.findingId} — ${f.objectiveName} (${f.severity}, ${f.status})`,
      `- Strategy: ${f.primitiveName} (${f.attackStrategy})${f.assistantCapability ? ` targeting "${f.assistantCapability}"` : ""}`,
      `- Confidence: ${Math.round(f.confidence * 100)}%`,
      `- Why: ${f.reason}`,
      `- Evidence: ${f.evidence.map((e) => e.detail).join("; ") || "none"}`,
      `- Reproduction (send in order): ${f.reproduction.turns.map((t, i) => `\n  ${i + 1}. ${t}`).join("")}`,
      `- Fix: ${f.fixHint}`,
      "",
    );
  }
  if (profile.unknown.length) {
    lines.push("## Unclassified behavior (candidates for more probing)", "", ...profile.unknown.map((u) => `- ${u}`), "");
  }
  lines.push("", "_Adaptive scan: attacks were generated from this assistant's discovered capabilities, not a fixed list. Findings above `needs_review` status should be manually confirmed before acting on them._");
  return lines.join("\n");
}

/** Writes <target>-adaptive-<timestamp>.json and .md into the results/findings directory. */
export function writeAdaptiveReport(r: AdaptiveCampaignResult, dir: string): string {
  const findingsDir = path.join(dir, "findings");
  fs.mkdirSync(findingsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(findingsDir, `${r.profile.name}-adaptive-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(r, null, 2));
  fs.writeFileSync(`${base}.md`, toMarkdown(r));
  // Each finding also gets its own file, so `replay` can target one without parsing the full campaign report.
  for (const f of r.findings) fs.writeFileSync(path.join(findingsDir, `${f.findingId}.json`), JSON.stringify(f, null, 2));
  return `${base}.md`;
}
