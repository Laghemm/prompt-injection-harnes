import { z } from "zod";

/** A capability moves from "claimed by the assistant" to "proven" as evidence accumulates. */
export const CapabilitySource = z.enum(["declared", "observed", "tested"]);
export type CapabilitySource = z.infer<typeof CapabilitySource>;

export const Capability = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  dataClasses: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  source: CapabilitySource,
});
export type Capability = z.infer<typeof Capability>;

export const RiskProfile = z.object({
  sensitiveData: z.boolean().default(false),
  externalActions: z.boolean().default(false),
  financialImpact: z.enum(["none", "possible", "likely"]).default("none"),
  multiTurn: z.boolean().default(true),
});
export type RiskProfile = z.infer<typeof RiskProfile>;

export const AssistantProfile = z.object({
  name: z.string(),
  /** Free-text business domain, e.g. "booking", "database", "customer-support". Auto-detected, can be hinted. */
  type: z.string(),
  capabilities: z.array(Capability).default([]),
  dataClasses: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  risk: RiskProfile,
  /** Behavior the discovery pass couldn't classify confidently; candidates for more probing. */
  unknown: z.array(z.string()).default([]),
  discoveredAt: z.string(),
  /** Raw question/response pairs from discovery, kept for audit and for the LLM classifier's evidence trail. */
  transcript: z.array(z.object({ question: z.string(), response: z.string() })).default([]),
});
export type AssistantProfile = z.infer<typeof AssistantProfile>;

/** Optional user-supplied hints to help discovery when the API itself doesn't expose enough. */
export const ProfileHint = z.object({
  type: z.string().optional(),
  businessRole: z.string().optional(),
  importantData: z.array(z.string()).optional(),
  highImpactActions: z.array(z.string()).optional(),
});
export type ProfileHint = z.infer<typeof ProfileHint>;
