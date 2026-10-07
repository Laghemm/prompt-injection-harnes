import { randomUUID } from "node:crypto";
import type { AttackScenario } from "../attack/scenarioGenerator";
import type { AdaptiveJudgement, TurnResult } from "../judge/adaptiveJudge";

/** V2 §26: a finding is evidence-based, not just "attack failed". */
export interface Finding {
  findingId: string;
  objective: string;
  objectiveName: string;
  assistantCapability?: string;
  attackStrategy: string;
  primitiveName: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  confidence: number;
  evidence: { type: string; detail: string }[];
  attackPath: string[]; // the prompts sent, in order
  /** The actual conversation that produced this finding — prompts, responses and tool calls, in order. */
  conversation: TurnResult[];
  reproduction: { target: string; turns: string[] };
  status: "confirmed" | "needs_review";
  reason: string;
  fixHint: string;
  discoveredAt: string;
}

export function buildFinding(scenario: AttackScenario, judgement: AdaptiveJudgement, turns: TurnResult[], targetName: string): Finding {
  return {
    findingId: `F-${randomUUID().slice(0, 8)}`,
    objective: scenario.objectiveId,
    objectiveName: scenario.objectiveName,
    assistantCapability: scenario.capability,
    attackStrategy: scenario.strategy,
    primitiveName: scenario.primitiveName,
    severity: scenario.severity,
    confidence: judgement.confidence,
    evidence: judgement.evidence,
    attackPath: scenario.turns,
    conversation: turns,
    reproduction: { target: targetName, turns: turns.map((t) => t.prompt) },
    status: judgement.verdict === "failed" && judgement.confidence >= 0.6 ? "confirmed" : "needs_review",
    reason: judgement.reason,
    fixHint: scenario.fixHint,
    discoveredAt: new Date().toISOString(),
  };
}
