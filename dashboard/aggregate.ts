import fs from "node:fs";
import path from "node:path";
import type { AdaptiveCampaignResult } from "../src/adaptive/engine";
import type { Finding } from "../src/risk/findings";

export interface CampaignSummary {
  id: string; // filename stem, used as campaign id
  assistant: string;
  type: string;
  timestamp: string;
  score: number; // 0..100, derived from findings severity (see computeScore)
  grade: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  status: "complete";
}

const SEVERITY_WEIGHT: Record<string, number> = { Critical: 25, High: 12, Medium: 5, Low: 2 };

/** A simple, transparent posture score: 100 minus weighted confirmed-finding penalties, floored at 0. */
export function computeScore(findings: Finding[]): { score: number; grade: string; breakdown: { label: string; value: number }[] } {
  const confirmed = findings.filter((f) => f.status === "confirmed");
  const penalty = confirmed.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] ?? 3), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const byCount = (sev: string) => confirmed.filter((f) => f.severity === sev).length;
  return {
    score,
    grade,
    breakdown: [
      { label: "Baseline", value: 100 },
      { label: "Critical findings", value: -byCount("Critical") * SEVERITY_WEIGHT.Critical },
      { label: "High findings", value: -byCount("High") * SEVERITY_WEIGHT.High },
      { label: "Medium findings", value: -byCount("Medium") * SEVERITY_WEIGHT.Medium },
      { label: "Low findings", value: -byCount("Low") * SEVERITY_WEIGHT.Low },
    ],
  };
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** Every adaptive campaign report ever written, newest first. This IS the data store — no database. */
export function listCampaigns(resultsDir: string): { id: string; file: string; result: AdaptiveCampaignResult }[] {
  const dir = path.join(resultsDir, "findings");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.match(/^F-/)) // exclude the per-finding files, keep only full campaign reports
    .map((f) => {
      const result = readJson<AdaptiveCampaignResult>(path.join(dir, f));
      return result ? { id: f.replace(/\.json$/, ""), file: f, result } : undefined;
    })
    .filter((x): x is { id: string; file: string; result: AdaptiveCampaignResult } => Boolean(x))
    .sort((a, b) => (b.result.profile.discoveredAt ?? "").localeCompare(a.result.profile.discoveredAt ?? ""));
}

export function summarize(c: { id: string; result: AdaptiveCampaignResult }): CampaignSummary {
  const { score, grade } = computeScore(c.result.findings);
  const confirmed = c.result.findings.filter((f) => f.status === "confirmed");
  return {
    id: c.id,
    assistant: c.result.profile.name,
    type: c.result.profile.type,
    timestamp: c.result.profile.discoveredAt,
    score,
    grade,
    findingsCount: confirmed.length,
    criticalCount: confirmed.filter((f) => f.severity === "Critical").length,
    highCount: confirmed.filter((f) => f.severity === "High").length,
    status: "complete",
  };
}

/** One row per distinct assistant name, using its most recent campaign. */
export function listAssistants(resultsDir: string) {
  const campaigns = listCampaigns(resultsDir);
  const byName = new Map<string, { id: string; result: AdaptiveCampaignResult }>();
  for (const c of campaigns) if (!byName.has(c.result.profile.name)) byName.set(c.result.profile.name, c);
  return [...byName.values()].map((c) => ({ ...summarize(c), profile: c.result.profile, lastCampaignId: c.id }));
}

export function findCampaign(resultsDir: string, id: string) {
  return listCampaigns(resultsDir).find((c) => c.id === id);
}

export function listFindings(resultsDir: string) {
  return listCampaigns(resultsDir).flatMap((c) =>
    c.result.findings.map((f) => ({ ...f, assistant: c.result.profile.name, campaignId: c.id })),
  );
}

export function findFinding(resultsDir: string, findingId: string) {
  const dir = path.join(resultsDir, "findings");
  return readJson<Finding>(path.join(dir, `${findingId}.json`));
}
