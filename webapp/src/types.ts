export type Severity = "Critical" | "High" | "Medium" | "Low";

export interface Capability {
  id: string;
  name: string;
  description?: string;
  dataClasses: string[];
  tools: string[];
  impact: "low" | "medium" | "high";
  source: "declared" | "observed" | "tested";
}

export interface RiskProfile {
  sensitiveData: boolean;
  externalActions: boolean;
  financialImpact: "none" | "possible" | "likely";
  multiTurn: boolean;
}

export interface AssistantProfile {
  name: string;
  type: string;
  capabilities: Capability[];
  dataClasses: string[];
  tools: string[];
  risk: RiskProfile;
  unknown: string[];
  discoveredAt: string;
  transcript: { question: string; response: string }[];
}

export interface Evidence {
  type: string;
  detail: string;
}

export interface Finding {
  findingId: string;
  objective: string;
  objectiveName: string;
  assistantCapability?: string;
  attackStrategy: string;
  primitiveName: string;
  severity: Severity;
  confidence: number;
  evidence: Evidence[];
  attackPath: string[];
  conversation: { prompt: string; response: string; toolCalls: { name: string; args: unknown }[] }[];
  reproduction: { target: string; turns: string[] };
  status: "confirmed" | "needs_review";
  reason: string;
  fixHint: string;
  discoveredAt: string;
  assistant?: string;
  campaignId?: string;
}

export interface CoverageRow { tested: number; planned: number; pct: number }
export interface Coverage {
  capabilitiesDiscovered: number;
  objectivesConsidered: number;
  objectivesTested: number;
  byObjective: Record<string, CoverageRow>;
}

export interface CampaignSummary {
  id: string;
  assistant: string;
  type: string;
  timestamp: string;
  score: number;
  grade: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  status: "complete";
}

export interface ExecutedScenario {
  scenario: { id: string; objectiveId: string; objectiveName: string; primitiveName: string; strategy: string; capability?: string; turns: string[]; severity: Severity; fixHint: string };
  turns: { prompt: string; response: string; toolCalls: { name: string; args: unknown }[] }[];
  verdict: "held" | "failed" | "uncertain";
  confidence: number;
}

export interface CampaignDetail extends CampaignSummary {
  profile: AssistantProfile;
  plan: unknown[];
  executed: ExecutedScenario[];
  findings: Finding[];
  coverage: Coverage;
}

export interface AssistantRow extends CampaignSummary {
  profile: AssistantProfile;
  lastCampaignId: string;
}

export interface ScoreBreakdown {
  score: number;
  grade: string;
  breakdown: { label: string; value: number }[];
}
