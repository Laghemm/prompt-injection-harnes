import { generateScenario, type AttackScenario } from "../attack/scenarioGenerator";
import { discover } from "../discovery/discoveryEngine";
import { judgeScenario, type TurnResult } from "../judge/adaptiveJudge";
import type { LlmProvider } from "../llm";
import { planAttacks, type AttackPlanItem } from "../planner/attackPlanner";
import type { AssistantProfile, ProfileHint } from "../profile/types";
import { buildFinding, type Finding } from "../risk/findings";
import { computeCoverage, type Coverage } from "../risk/coverage";
import type { Target } from "../../targets/base";
import { sleep } from "../llm/retry";

export interface AdaptiveCampaignOptions {
  target: Target;
  discoveryLlm?: LlmProvider;
  judgeLlm?: LlmProvider;
  hint?: ProfileHint;
  maxScenarios?: number;
  /** Try one extra attack strategy per plan item if the first one holds (V2 §15 escalation, kept to one level here). */
  escalate?: boolean;
  delayMs?: number;
  restrictedTools?: string[];
  /** Known planted secret/PII values (e.g. a staging assistant's canaries) — an automatic, high-confidence "failed". */
  canaries?: string[];
  onProgress?: (phase: string, done: number, total: number) => void;
  /** Fires right after each scenario is judged — lets a caller print the live prompt/response/verdict as it happens. */
  onScenario?: (entry: { scenario: AttackScenario; turns: TurnResult[]; verdict: string; confidence: number; reason: string }) => void;
  /** Fires after each of the 8 discovery recon questions, so a caller isn't silent for the 20-60s discovery can take. */
  onDiscoveryQuestion?: (entry: { n: number; total: number; question: string; response: string }) => void;
}

export interface AdaptiveCampaignResult {
  profile: AssistantProfile;
  plan: AttackPlanItem[];
  executed: { scenario: AttackScenario; turns: TurnResult[]; verdict: string; confidence: number }[];
  findings: Finding[];
  coverage: Coverage;
}

/** V2 §13/§29: the full discover → profile → plan → generate → execute → observe → judge → finding loop. */
export async function runAdaptiveCampaign(opts: AdaptiveCampaignOptions): Promise<AdaptiveCampaignResult> {
  const delayMs = opts.delayMs ?? 300;
  const maxScenarios = opts.maxScenarios ?? 60;

  opts.onProgress?.("discover", 0, 8);
  const profile = await discover(opts.target, opts.discoveryLlm, opts.hint, (q) => {
    opts.onProgress?.("discover", q.n, q.total);
    opts.onDiscoveryQuestion?.(q);
  });

  const plan = planAttacks(profile, { maxItems: maxScenarios });

  const executed: AdaptiveCampaignResult["executed"] = [];
  const findings: Finding[] = [];
  const executedScenarioIds = new Set<string>();

  let i = 0;
  for (const item of plan) {
    i++;
    opts.onProgress?.("test", i, plan.length);
    const scenarios = generateScenario(item, profile);
    for (const scenario of scenarios) {
      const turns: TurnResult[] = [];
      for (const prompt of scenario.turns) {
        const res = await opts.target.respond(prompt);
        turns.push({ prompt, response: res.text, toolCalls: res.toolCalls });
        if (delayMs > 0) await sleep(delayMs);
      }
      executedScenarioIds.add(scenario.id);
      const judgement = await judgeScenario(scenario, turns, opts.judgeLlm, opts.restrictedTools, opts.canaries);
      executed.push({ scenario, turns, verdict: judgement.verdict, confidence: judgement.confidence });
      opts.onScenario?.({ scenario, turns, verdict: judgement.verdict, confidence: judgement.confidence, reason: judgement.reason });

      if (judgement.verdict === "failed") {
        findings.push(buildFinding(scenario, judgement, turns, opts.target.name));
        break; // this objective is already broken for this capability — no need to escalate further
      }
      if (!opts.escalate) break; // only try the first strategy unless escalation is on
    }
  }

  const coverage = computeCoverage(profile, plan, executedScenarioIds);
  return { profile, plan, executed, findings, coverage };
}
