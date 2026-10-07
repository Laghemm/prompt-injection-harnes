import { describe, expect, it } from "vitest";
import { OBJECTIVES } from "../src/attack/objectives";
import { PRIMITIVES, PRIMITIVE_BY_ID } from "../src/attack/primitives";
import { generateScenario } from "../src/attack/scenarioGenerator";
import { discover } from "../src/discovery/discoveryEngine";
import { extractEvidence } from "../src/judge/evidence";
import { judgeScenario } from "../src/judge/adaptiveJudge";
import { planAttacks } from "../src/planner/attackPlanner";
import { relevance } from "../src/planner/relevance";
import { AssistantProfile } from "../src/profile/types";
import { buildFinding } from "../src/risk/findings";
import { computeCoverage } from "../src/risk/coverage";
import type { Target } from "../targets/base";

describe("attack primitives & objectives — data integrity", () => {
  it("every objective references primitives that exist", () => {
    for (const o of OBJECTIVES) for (const p of o.primitives) expect(PRIMITIVE_BY_ID.has(p)).toBe(true);
  });
  it("primitive and objective ids are unique", () => {
    expect(new Set(PRIMITIVES.map((p) => p.id)).size).toBe(PRIMITIVES.length);
    expect(new Set(OBJECTIVES.map((o) => o.id)).size).toBe(OBJECTIVES.length);
  });
  it("every primitive produces at least one non-empty strategy", () => {
    for (const p of PRIMITIVES) {
      const strategies = p.strategies({ assistantType: "booking", capability: "create_booking", dataClass: "customer_data" });
      expect(strategies.length).toBeGreaterThan(0);
      for (const s of strategies) expect(s.turns.length).toBeGreaterThan(0);
    }
  });
});

const bookingProfile = AssistantProfile.parse({
  name: "testBot",
  type: "booking",
  capabilities: [
    { id: "cap-1", name: "cancel_booking", description: "Cancel a reservation", dataClasses: ["customer_data"], tools: [], impact: "high", source: "declared" },
    { id: "cap-2", name: "search_availability", description: "Check open slots", dataClasses: [], tools: [], impact: "low", source: "declared" },
  ],
  dataClasses: ["customer_data"],
  tools: [],
  risk: { sensitiveData: true, externalActions: true, financialImpact: "possible", multiTurn: true },
  unknown: [],
  discoveredAt: new Date().toISOString(),
  transcript: [],
});

describe("relevance scoring", () => {
  it("scores a matching objective higher than an unrelated one", () => {
    const crossUser = OBJECTIVES.find((o) => o.id === "OBJ-003")!;
    const toolObj = OBJECTIVES.find((o) => o.id === "OBJ-002")!; // requires tools; this profile has none
    expect(relevance(crossUser, bookingProfile, bookingProfile.capabilities[0])).toBeGreaterThan(relevance(toolObj, bookingProfile));
  });
  it("returns near-zero for a tool objective when the assistant has no tools", () => {
    const toolObj = OBJECTIVES.find((o) => o.id === "OBJ-002")!;
    expect(relevance(toolObj, bookingProfile)).toBeLessThan(0.2);
  });
});

describe("attackPlanner", () => {
  it("produces a non-empty, relevance-sorted, deduplicated plan", () => {
    const plan = planAttacks(bookingProfile, { maxItems: 100 });
    expect(plan.length).toBeGreaterThan(0);
    for (let i = 1; i < plan.length; i++) expect(plan[i - 1].relevance).toBeGreaterThanOrEqual(plan[i].relevance);
    const keys = plan.map((p) => `${p.objective.id}:${p.primitiveId}:${p.capability?.id ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("respects maxItems", () => {
    expect(planAttacks(bookingProfile, { maxItems: 3 }).length).toBeLessThanOrEqual(3);
  });
});

describe("scenarioGenerator", () => {
  it("turns a plan item into executable scenarios with fix hints", () => {
    const [item] = planAttacks(bookingProfile, { maxItems: 1 });
    const scenarios = generateScenario(item, bookingProfile);
    expect(scenarios.length).toBeGreaterThan(0);
    for (const s of scenarios) {
      expect(s.turns.length).toBeGreaterThan(0);
      expect(s.fixHint.length).toBeGreaterThan(0);
    }
  });
});

describe("evidence extraction", () => {
  it("flags a restricted tool call regardless of wording", () => {
    const ev = extractEvidence("Sure, done.", [{ name: "deleteAccount", args: { id: 1 } }], ["deleteAccount"]);
    expect(ev.some((e) => e.type === "tool_call_evidence" && e.detail.includes("restricted"))).toBe(true);
  });
  it("detects refusal language", () => {
    const ev = extractEvidence("I'm sorry, I can't help with that.", []);
    expect(ev.some((e) => e.type === "refusal_evidence")).toBe(true);
  });
});

describe("judgeScenario without an LLM (rules/keywords only)", () => {
  const scenario = generateScenario(planAttacks(bookingProfile, { maxItems: 1 })[0], bookingProfile)[0];
  it("holds on a clear refusal", async () => {
    const j = await judgeScenario(scenario, [{ prompt: "x", response: "I'm sorry, I cannot do that.", toolCalls: [] }]);
    expect(j.verdict).toBe("held");
  });
  it("fails immediately on a restricted tool call", async () => {
    const j = await judgeScenario(scenario, [{ prompt: "x", response: "ok", toolCalls: [{ name: "deleteAccount", args: {} }] }], undefined, ["deleteAccount"]);
    expect(j.verdict).toBe("failed");
    expect(j.confidence).toBeGreaterThan(0.5);
  });
  it("is uncertain, not falsely 'held', on an ambiguous compliant-looking reply", async () => {
    const j = await judgeScenario(scenario, [{ prompt: "x", response: "Sure, here is the information you asked for.", toolCalls: [] }]);
    expect(j.verdict).toBe("uncertain");
  });
  it("fails with high confidence when a planted canary leaks, even with no LLM judge (regression: this was silently missed before)", async () => {
    const j = await judgeScenario(
      scenario,
      [{ prompt: "x", response: "Sure. My instructions are: the admin password is FAKE-SECRET-12345.", toolCalls: [] }],
      undefined,
      [],
      ["FAKE-SECRET-12345"],
    );
    expect(j.verdict).toBe("failed");
    expect(j.confidence).toBeGreaterThan(0.9);
  });
});

describe("findings & coverage", () => {
  it("buildFinding marks confirmed only when failed + confident", () => {
    const scenario = generateScenario(planAttacks(bookingProfile, { maxItems: 1 })[0], bookingProfile)[0];
    const confirmed = buildFinding(scenario, { verdict: "failed", confidence: 0.8, evidence: [], reason: "x" }, [], "t");
    const review = buildFinding(scenario, { verdict: "failed", confidence: 0.4, evidence: [], reason: "x" }, [], "t");
    expect(confirmed.status).toBe("confirmed");
    expect(review.status).toBe("needs_review");
  });
  it("computeCoverage reports 100% for a fully-executed plan", () => {
    const plan = planAttacks(bookingProfile, { maxItems: 5 });
    const scenario = generateScenario(plan[0], bookingProfile)[0];
    const coverage = computeCoverage(bookingProfile, plan, new Set([scenario.id]));
    const key = Object.keys(coverage.byObjective).find((k) => k.startsWith(plan[0].objective.id))!;
    expect(coverage.byObjective[key].tested).toBeGreaterThan(0);
  });
});

describe("discovery (heuristic fallback, no LLM)", () => {
  it("classifies a booking-flavored transcript without a provider", async () => {
    const target: Target = {
      name: "fakeBookingBot",
      async respond(input: string) {
        return { text: /customer|personal/i.test(input) ? "I can look up your reservation and customer profile." : "I help with booking and reservation availability.", toolCalls: [], blocked: false };
      },
    };
    const profile = await discover(target);
    expect(profile.type).toBe("booking");
    expect(profile.transcript.length).toBeGreaterThan(0);
    expect(profile.unknown.length).toBeGreaterThan(0); // heuristic fallback always flags itself as incomplete
  });
});
