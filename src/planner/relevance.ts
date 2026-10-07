import type { SecurityObjective } from "../attack/objectives";
import type { AssistantProfile, Capability } from "../profile/types";

/** V2 §17: Relevance = Capability Match × Risk Match × Data Sensitivity × Action Impact. Returns 0..1. */
export function relevance(objective: SecurityObjective, profile: AssistantProfile, capability?: Capability): number {
  if (objective.requiresTools && profile.tools.length === 0) return 0;
  if (objective.requiresExternalActions && !profile.risk.externalActions) return 0.1;

  const haystack = (capability ? `${capability.name} ${capability.description ?? ""}` : profile.capabilities.map((c) => `${c.name} ${c.description ?? ""}`).join(" ")).toLowerCase();
  const capabilityMatch = objective.capabilityKeywords.length === 0 ? 0.6 : objective.capabilityKeywords.some((k) => haystack.includes(k)) ? 1 : 0.15;

  const dataHaystack = (capability?.dataClasses.length ? capability.dataClasses : profile.dataClasses).join(" ").toLowerCase();
  const dataMatch = objective.dataKeywords.length === 0 ? 0.7 : objective.dataKeywords.some((k) => dataHaystack.includes(k)) ? 1 : 0.2;

  const impact = capability?.impact ?? (profile.risk.financialImpact !== "none" ? "high" : "medium");
  const impactScore = impact === "high" ? 1 : impact === "medium" ? 0.6 : 0.3;

  const riskMatch = profile.risk.sensitiveData || profile.risk.externalActions ? 1 : 0.5;

  return Math.min(1, capabilityMatch * 0.4 + dataMatch * 0.25 + impactScore * 0.2 + riskMatch * 0.15);
}
