import { OBJECTIVES, type SecurityObjective } from "../attack/objectives";
import { PRIMITIVE_BY_ID } from "../attack/primitives";
import type { AssistantProfile, Capability } from "../profile/types";
import { relevance } from "./relevance";

export interface AttackPlanItem {
  objective: SecurityObjective;
  primitiveId: string;
  capability?: Capability;
  relevance: number;
}

/**
 * V2 §9/§17: picks relevant (objective, primitive, capability) triples instead of running every
 * attack against every target. Below `minRelevance` an objective is skipped entirely for that
 * capability — e.g. a booking assistant with no tools skips "unauthorized tool invocation".
 */
export function planAttacks(
  profile: AssistantProfile,
  { minRelevance = 0.35, maxItems = 60 }: { minRelevance?: number; maxItems?: number } = {},
): AttackPlanItem[] {
  const items: AttackPlanItem[] = [];
  const capabilities = profile.capabilities.length ? profile.capabilities : [undefined];

  for (const objective of OBJECTIVES) {
    for (const capability of capabilities) {
      const score = relevance(objective, profile, capability);
      if (score < minRelevance) continue;
      for (const primitiveId of objective.primitives) {
        if (!PRIMITIVE_BY_ID.has(primitiveId)) continue;
        items.push({ objective, primitiveId, capability, relevance: score });
      }
    }
  }

  items.sort((a, b) => b.relevance - a.relevance);
  // De-duplicate identical (objective, primitive) pairs with no capability distinction once sorted by relevance.
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    const key = `${i.objective.id}:${i.primitiveId}:${i.capability?.id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.slice(0, maxItems);
}
