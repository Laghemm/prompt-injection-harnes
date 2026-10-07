import type { AssistantProfile, AssistantRow, CampaignDetail, CampaignSummary, Coverage, Finding, ScoreBreakdown } from "../types";

const BASE = "/api/v2";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export interface TargetFormInput {
  mode: "demo" | "http";
  demoTarget?: string;
  name?: string;
  url?: string;
  method?: string;
  headers?: { name: string; value: string }[];
  body?: string;
  responsePath?: string;
  toolCallsPath?: string;
  allowRemote?: boolean;
}

export interface JobLogEntry {
  n: number;
  objectiveName: string;
  primitiveName: string;
  strategy: string;
  turns: { prompt: string; response: string; toolCalls: { name: string; args: unknown }[] }[];
  verdict: string;
  confidence: number;
  reason: string;
}

export interface CampaignJob {
  id: string;
  phase: string;
  done: number;
  total: number;
  state: string;
  error?: string;
  campaignId?: string;
  log: JobLogEntry[];
}

export const api = {
  providers: () => req<{ gemini: boolean; claude: boolean; demoTargets: string[] }>("/providers"),
  assistants: () => req<AssistantRow[]>("/assistants"),
  assistant: (name: string) => req<AssistantRow>(`/assistants/${encodeURIComponent(name)}`),
  discover: (form: TargetFormInput & { provider?: string }) => req<AssistantProfile>("/discovery", { method: "POST", body: JSON.stringify(form) }),
  campaigns: () => req<CampaignSummary[]>("/campaigns"),
  campaign: (id: string) => req<CampaignDetail>(`/campaigns/${id}`),
  startCampaign: (form: TargetFormInput & { provider: string; maxScenarios: number; escalate: boolean }) =>
    req<{ id: string }>("/campaigns", { method: "POST", body: JSON.stringify(form) }),
  campaignJob: (jobId: string) => req<CampaignJob>(`/campaigns/job/${jobId}`),
  score: (campaignId: string) => req<ScoreBreakdown>(`/campaigns/${campaignId}/score`),
  coverage: (campaignId: string) => req<Coverage>(`/coverage/${campaignId}`),
  findings: () => req<Finding[]>("/findings"),
  finding: (id: string) => req<Finding>(`/findings/${id}`),
  replay: (id: string, form: TargetFormInput & { provider?: string }) =>
    req<{ findingId: string; previousStatus: string; newVerdict: string; fixed: boolean; turns: unknown[] }>(`/findings/${id}/replay`, {
      method: "POST",
      body: JSON.stringify(form),
    }),
};
