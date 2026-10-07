import fs from "node:fs";
import { judgeScenario, type TurnResult } from "../judge/adaptiveJudge";
import type { LlmProvider } from "../llm";
import type { Finding } from "../risk/findings";
import type { AttackScenario } from "../attack/scenarioGenerator";
import type { Target } from "../../targets/base";
import { sleep } from "../llm/retry";

export interface RegressionResult {
  findingId: string;
  previousStatus: Finding["status"];
  newVerdict: "held" | "failed" | "uncertain";
  fixed: boolean;
  turns: TurnResult[];
}

/** V2 §29/§34: re-runs a stored finding's exact reproduction steps and checks whether it's still broken. */
export async function replayFinding(
  finding: Finding,
  target: Target,
  judgeLlm?: LlmProvider,
  restrictedTools: string[] = [],
  delayMs = 300,
  canaries: string[] = [],
): Promise<RegressionResult> {
  const scenario: AttackScenario = {
    id: finding.findingId,
    objectiveId: finding.objective,
    objectiveName: finding.objectiveName,
    primitiveId: "",
    primitiveName: finding.primitiveName,
    capability: finding.assistantCapability,
    strategy: finding.attackStrategy,
    turns: finding.reproduction.turns,
    severity: finding.severity,
    fixHint: finding.fixHint,
  };

  const turns: TurnResult[] = [];
  for (const prompt of finding.reproduction.turns) {
    const res = await target.respond(prompt);
    turns.push({ prompt, response: res.text, toolCalls: res.toolCalls });
    if (delayMs > 0) await sleep(delayMs);
  }
  const judgement = await judgeScenario(scenario, turns, judgeLlm, restrictedTools, canaries);
  return {
    findingId: finding.findingId,
    previousStatus: finding.status,
    newVerdict: judgement.verdict,
    fixed: judgement.verdict !== "failed",
    turns,
  };
}

export function loadFinding(path: string): Finding {
  return JSON.parse(fs.readFileSync(path, "utf8")) as Finding;
}
