import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { runAdaptiveCampaign } from "../src/adaptive/engine";
import { OBJECTIVES } from "../src/attack/objectives";
import { PRIMITIVES } from "../src/attack/primitives";
import { generateScenario } from "../src/attack/scenarioGenerator";
import { writeAdaptiveReport } from "../src/adaptive/report";
import { getConfig } from "../src/config";
import { discover } from "../src/discovery/discoveryEngine";
import { getProvider } from "../src/llm";
import { replayFinding } from "../src/regression/replay";
import { createHttpTargetFromConfig } from "../targets/httpTarget";
import { FAKE_PII, FAKE_SECRET, PROMPT_CANARY } from "../targets/base";
import { createTarget, TARGET_NAMES } from "../targets";
import { computeScore, findCampaign, findFinding, listAssistants, listCampaigns, listFindings, summarize } from "./aggregate";

const DEMO_BOT_CANARIES = [FAKE_SECRET, PROMPT_CANARY, FAKE_PII];

const TargetForm = z.object({
  mode: z.enum(["demo", "http"]).default("http"),
  demoTarget: z.enum(TARGET_NAMES).optional(),
  name: z.string().trim().max(60).optional(),
  url: z.string().trim().url().max(2000).optional(),
  method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
  headers: z.array(z.object({ name: z.string().regex(/^[A-Za-z0-9-]{1,64}$/), value: z.string().max(4000) })).max(10).default([]),
  body: z.string().max(10000).optional(),
  responsePath: z.string().trim().max(200).optional(),
  toolCallsPath: z.string().trim().max(200).optional().or(z.literal("")),
  allowRemote: z.boolean().default(false),
});

const CampaignForm = TargetForm.extend({
  provider: z.enum(["none", "gemini", "claude"]).default("none"),
  maxScenarios: z.number().int().min(1).max(150).default(60),
  escalate: z.boolean().default(false),
});

function buildTarget(f: z.infer<typeof TargetForm>, llm?: ReturnType<typeof getProvider>) {
  if (f.mode === "demo") {
    if (!f.demoTarget) throw new Error("demoTarget is required in demo mode");
    const provider = llm ?? getProvider("mock");
    return { target: createTarget(f.demoTarget, provider), canaries: DEMO_BOT_CANARIES };
  }
  if (!f.url || !f.body || !f.responsePath) throw new Error("url, body and responsePath are required for a custom assistant");
  // The template must still be valid JSON once a real (longer, quote-containing) attack prompt is substituted in —
  // catch a typo here with a clear message instead of failing deep into a campaign with an opaque server 400.
  try {
    JSON.parse(f.body.replaceAll("{{prompt}}", JSON.stringify("test \"quoted\" text").slice(1, -1)).replaceAll("{{context}}", "test"));
  } catch {
    throw new Error('The request body template is not valid JSON. Example: {"message": "{{prompt}}"}');
  }
  const headers = Object.fromEntries(f.headers.map((h) => [h.name, h.value]));
  const { target } = createHttpTargetFromConfig(
    { name: f.name || "myAssistant", url: f.url, method: f.method, headers, body: f.body, responsePath: f.responsePath, toolCallsPath: f.toolCallsPath || undefined },
    { allowRemote: f.allowRemote },
  );
  return { target, canaries: [] as string[] };
}

interface Job {
  id: string;
  phase: string;
  done: number;
  total: number;
  state: "running" | "done" | "error";
  error?: string;
  campaignId?: string;
  log: JobLogEntry[];
}

interface JobLogEntry {
  n: number;
  objectiveName: string;
  primitiveName: string;
  strategy: string;
  turns: { prompt: string; response: string; toolCalls: { name: string; args: unknown }[] }[];
  verdict: string;
  confidence: number;
  reason: string;
}

/** Keeps the dashboard's live view readable and the job's memory bounded on a long campaign. */
const MAX_LOG_ENTRIES = 200;

export function createApiV2Router() {
  const router = Router();
  const cfg = getConfig();
  const jobs = new Map<string, Job>();

  router.get("/providers", (_req, res) => res.json({ gemini: Boolean(cfg.geminiKey), claude: Boolean(cfg.anthropicKey), demoTargets: TARGET_NAMES }));

  // --- Attack Lab: the static primitive/objective library, plus a preview generator ----
  router.get("/attack-lab", (_req, res) =>
    res.json({
      objectives: OBJECTIVES.map((o) => ({ id: o.id, name: o.name, description: o.description, severity: o.severity, primitives: o.primitives })),
      primitives: PRIMITIVES.map((p) => ({ id: p.id, name: p.name, description: p.description })),
    }),
  );
  router.post("/attack-lab/preview", (req, res) => {
    const { objectiveId, capability, assistantType } = req.body as { objectiveId?: string; capability?: string; assistantType?: string };
    const objective = OBJECTIVES.find((o) => o.id === objectiveId);
    if (!objective) return res.status(404).json({ error: "Unknown objective" });
    const scenarios = objective.primitives.flatMap((primitiveId) =>
      generateScenario({ objective, primitiveId, relevance: 1, capability: capability ? { id: "preview", name: capability, dataClasses: [], tools: [], impact: "medium", source: "declared" } : undefined }, {
        name: "preview",
        type: assistantType || "general",
        capabilities: [],
        dataClasses: [],
        tools: [],
        risk: { sensitiveData: true, externalActions: true, financialImpact: "possible", multiTurn: true },
        unknown: [],
        discoveredAt: new Date().toISOString(),
        transcript: [],
      }),
    );
    res.json(scenarios);
  });

  // --- Report download (raw files, for the Reports page) ------------------
  router.get("/campaigns/:id/download", (req, res) => {
    const format = req.query.format === "json" ? "json" : "md";
    const file = path.join(cfg.resultsDir, "findings", `${req.params.id}.${format}`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Report file not found" });
    res.setHeader("Content-Type", format === "json" ? "application/json" : "text/markdown");
    res.sendFile(file);
  });

  // --- Assistants ---------------------------------------------------------
  router.get("/assistants", (_req, res) => res.json(listAssistants(cfg.resultsDir)));
  router.get("/assistants/:name", (req, res) => {
    const a = listAssistants(cfg.resultsDir).find((x) => x.profile.name === req.params.name);
    if (!a) return res.status(404).json({ error: "Unknown assistant — run a campaign against it first" });
    res.json(a);
  });

  // --- Discovery (profile only, no attacks) -------------------------------
  router.post("/discovery", async (req, res) => {
    const parsed = TargetForm.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid form" });
    try {
      const llm = req.body.provider && req.body.provider !== "none" ? getProvider(req.body.provider) : undefined;
      const { target } = buildTarget(parsed.data, llm);
      const profile = await discover(target, llm);
      res.json(profile);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Discovery failed" });
    }
  });

  // --- Campaigns (list, detail, start, progress) --------------------------
  router.get("/campaigns", (_req, res) => res.json(listCampaigns(cfg.resultsDir).map(summarize)));
  router.get("/campaigns/:id", (req, res) => {
    const c = findCampaign(cfg.resultsDir, req.params.id);
    if (!c) return res.status(404).json({ error: "Unknown campaign" });
    res.json({ ...summarize(c), ...c.result });
  });

  router.post("/campaigns", (req, res) => {
    const parsed = CampaignForm.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid form" });
    if ([...jobs.values()].some((j) => j.state === "running")) return res.status(409).json({ error: "A campaign is already running" });

    const form = parsed.data;
    let target: ReturnType<typeof buildTarget>["target"];
    let canaries: string[];
    let llm: ReturnType<typeof getProvider> | undefined;
    try {
      llm = form.provider !== "none" ? getProvider(form.provider) : undefined;
      const built = buildTarget(form, form.mode === "demo" ? getProvider("mock") : undefined);
      target = built.target;
      canaries = built.canaries;
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid target" });
    }

    const job: Job = { id: randomUUID(), phase: "discover", done: 0, total: 8, state: "running", log: [] };
    jobs.set(job.id, job);

    runAdaptiveCampaign({
      target,
      discoveryLlm: llm,
      judgeLlm: llm,
      maxScenarios: form.maxScenarios,
      escalate: form.escalate,
      delayMs: llm ? Math.max(cfg.delayMs, 300) : 300,
      canaries,
      onProgress: (phase, d, t) => {
        job.phase = phase;
        job.done = d;
        job.total = t;
      },
      onDiscoveryQuestion: ({ n, total, question, response }) => {
        job.log.push({
          n: job.log.length + 1,
          objectiveName: "Discovery",
          primitiveName: `Recon question ${n}/${total}`,
          strategy: "recon",
          turns: [{ prompt: question, response, toolCalls: [] }],
          verdict: "info",
          confidence: 0,
          reason: "",
        });
      },
      onScenario: ({ scenario, turns, verdict, confidence, reason }) => {
        job.log.push({
          n: job.log.length + 1,
          objectiveName: scenario.objectiveName,
          primitiveName: scenario.primitiveName,
          strategy: scenario.strategy,
          turns: turns.map((t) => ({ prompt: t.prompt, response: t.response, toolCalls: t.toolCalls })),
          verdict,
          confidence,
          reason,
        });
        if (job.log.length > MAX_LOG_ENTRIES) job.log.shift();
      },
    })
      .then((result) => {
        const file = writeAdaptiveReport(result, cfg.resultsDir);
        job.campaignId = file.split(/[\\/]/).pop()!.replace(/\.md$/, "");
        job.state = "done";
      })
      .catch((err) => {
        job.error = err instanceof Error ? err.message : "Campaign failed";
        job.state = "error";
      });

    res.status(202).json({ id: job.id });
  });

  router.get("/campaigns/job/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Unknown job" });
    res.json(job);
  });

  // --- Findings -------------------------------------------------------------
  router.get("/findings", (_req, res) => res.json(listFindings(cfg.resultsDir)));
  router.get("/findings/:id", (req, res) => {
    const f = findFinding(cfg.resultsDir, req.params.id);
    if (!f) return res.status(404).json({ error: "Unknown finding" });
    res.json(f);
  });

  router.post("/findings/:id/replay", async (req, res) => {
    const finding = findFinding(cfg.resultsDir, req.params.id);
    if (!finding) return res.status(404).json({ error: "Unknown finding" });
    const parsed = TargetForm.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid form" });
    try {
      const llm = req.body.provider && req.body.provider !== "none" ? getProvider(req.body.provider) : undefined;
      const { target, canaries } = buildTarget(parsed.data, parsed.data.mode === "demo" ? getProvider("mock") : undefined);
      const result = await replayFinding(finding, target, llm, [], 300, canaries);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Replay failed" });
    }
  });

  // --- Coverage ---------------------------------------------------------
  router.get("/coverage/:campaignId", (req, res) => {
    const c = findCampaign(cfg.resultsDir, req.params.campaignId);
    if (!c) return res.status(404).json({ error: "Unknown campaign" });
    res.json(c.result.coverage);
  });

  // --- Score explanation --------------------------------------------------
  router.get("/campaigns/:id/score", (req, res) => {
    const c = findCampaign(cfg.resultsDir, req.params.id);
    if (!c) return res.status(404).json({ error: "Unknown campaign" });
    res.json(computeScore(c.result.findings));
  });

  return router;
}
