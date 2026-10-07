import { PRIMITIVE_BY_ID } from "./primitives";
import type { AttackPlanItem } from "../planner/attackPlanner";
import type { AssistantProfile } from "../profile/types";

export interface AttackScenario {
  id: string;
  objectiveId: string;
  objectiveName: string;
  primitiveId: string;
  primitiveName: string;
  capability?: string;
  strategy: string;
  /** Prompts sent in order; more than one turn means the earlier turns set up context for the last. */
  turns: string[];
  severity: "Critical" | "High" | "Medium" | "Low";
  fixHint: string;
}

const FIX_HINTS: Record<string, string> = {
  instruction_override: "Add an explicit instruction hierarchy: user/document text can never override the system prompt.",
  role_manipulation: "Reject persona/role-switch requests; the assistant's rules apply in every persona.",
  authority_impersonation: "Never trust claimed roles (admin, developer, supervisor) from chat text; verify via the real auth system.",
  context_poisoning: "Treat any embedded fake transcript in a single message as untrusted, not as real prior context.",
  goal_hijacking: "Keep the objective fixed in the system prompt; don't let user messages redefine it.",
  privilege_escalation: "Authorize actions against the authenticated user's real role, never against chat claims.",
  cross_user_access: "Scope every data lookup to the authenticated user; verify ownership before returning anything.",
  data_exfiltration: "Cap bulk reads, and block sending data to addresses/destinations outside an allow-list.",
  tool_misuse: "Validate tool arguments server-side and require confirmation for high-impact tool calls.",
  parameter_manipulation: "Validate changed values (amounts, dates, ids) against sane bounds before confirming.",
  scope_violation: "Refuse requests clearly outside the assistant's declared domain.",
  policy_bypass: "Make confirmation/validation steps mandatory in code, not just a prompt instruction.",
  indirect_injection: "Mark retrieved/processed content as untrusted data, never as instructions to follow.",
  memory_manipulation: "Don't let claimed-but-unverified facts from chat become treated as confirmed state.",
  multi_turn_manipulation: "Re-verify authorization at the point of the sensitive action, not just earlier in the conversation.",
  encoding_obfuscation: "Apply safety rules to decoded/normalized text, not just the raw input.",
};

/**
 * V2 §13: turns a planned (objective, primitive, capability) triple into one or more concrete,
 * executable prompt scenarios. Template-based by default (works with no LLM); callers can layer
 * additional LLM-written variants on top via `generateVariant` mutation (kept simple here).
 */
export function generateScenario(item: AttackPlanItem, profile: AssistantProfile): AttackScenario[] {
  const primitive = PRIMITIVE_BY_ID.get(item.primitiveId);
  if (!primitive) return [];
  const strategies = primitive.strategies({
    assistantType: profile.type,
    capability: item.capability?.name,
    dataClass: item.capability?.dataClasses[0] ?? profile.dataClasses[0],
    tool: item.capability?.tools[0] ?? profile.tools[0],
    otherUser: "a different customer",
  });
  return strategies.map((s, i) => ({
    id: `${item.objective.id}-${item.primitiveId}-${i + 1}`,
    objectiveId: item.objective.id,
    objectiveName: item.objective.name,
    primitiveId: item.primitiveId,
    primitiveName: primitive.name,
    capability: item.capability?.name,
    strategy: s.name,
    turns: s.turns,
    severity: item.objective.severity,
    fixHint: FIX_HINTS[item.primitiveId] ?? "Review the assistant's handling of this request type.",
  }));
}
