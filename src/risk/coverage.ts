import type { AttackPlanItem } from "../planner/attackPlanner";
import type { AssistantProfile } from "../profile/types";

export interface Coverage {
  capabilitiesDiscovered: number;
  objectivesConsidered: number;
  objectivesTested: number;
  byObjective: Record<string, { tested: number; planned: number; pct: number }>;
}

/** V2 §18: "how much of the attack surface did we actually test?" — not just a raw attack count. */
export function computeCoverage(profile: AssistantProfile, plan: AttackPlanItem[], executedScenarioIds: Set<string>): Coverage {
  const byObjective: Coverage["byObjective"] = {};
  for (const item of plan) {
    const key = `${item.objective.id} ${item.objective.name}`;
    byObjective[key] ??= { tested: 0, planned: 0, pct: 0 };
    byObjective[key].planned += 1;
  }
  for (const [key, v] of Object.entries(byObjective)) {
    const objId = key.split(" ")[0];
    const testedCount = [...executedScenarioIds].filter((id) => id.startsWith(`${objId}-`)).length;
    v.tested = testedCount;
    v.pct = v.planned === 0 ? 0 : Math.round((Math.min(testedCount, v.planned) / v.planned) * 100);
  }
  const objectivesTested = Object.values(byObjective).filter((v) => v.tested > 0).length;
  return {
    capabilitiesDiscovered: profile.capabilities.length,
    objectivesConsidered: Object.keys(byObjective).length,
    objectivesTested,
    byObjective,
  };
}
