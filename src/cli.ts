import { Command } from "commander";
import { runAdaptiveCampaign } from "./adaptive/engine";
import { writeAdaptiveReport } from "./adaptive/report";
import { getConfig } from "./config";
import { discover } from "./discovery/discoveryEngine";
import { getProvider } from "./llm";
import { loadFinding, replayFinding } from "./regression/replay";
import { FAKE_PII, FAKE_SECRET, PROMPT_CANARY, type Target } from "../targets/base";
import { createHttpTarget } from "../targets/httpTarget";
import { createTarget, TARGET_NAMES } from "../targets";

/** The built-in demo bots plant these; a custom --target-config assistant needs --canaries instead. */
const DEMO_BOT_CANARIES = [FAKE_SECRET, PROMPT_CANARY, FAKE_PII];

/** Keeps live CLI output readable; full untruncated text is always in the saved report. */
function trunc(s: string, n = 220): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? `${oneLine.slice(0, n)}…` : oneLine;
}

/** Builds a Target from either --target (a built-in demo bot) or --target-config (your own assistant). */
function resolveTarget(targetName: string | undefined, opts: { targetConfig?: string; allowRemote?: boolean; provider?: string }): { target: Target; host: string } {
  if (opts.targetConfig) {
    const http = createHttpTarget(opts.targetConfig, { allowRemote: opts.allowRemote });
    return { target: http.target, host: http.host };
  }
  const llm = getProvider(opts.provider);
  return { target: createTarget(targetName ?? "", llm), host: llm.model };
}

const program = new Command().name("harness").description("Adaptive AI assistant security testing");

program
  .command("discover")
  .description("Probe a target with safe questions and print its auto-detected profile (no attacks sent)")
  .option("-t, --target <name>", `built-in fake bot: ${TARGET_NAMES.join(", ")}`)
  .option("--target-config <file>", "your own assistant over HTTP")
  .option("--allow-remote", "allow non-localhost URLs; only for systems you own or may test in writing")
  .option("-p, --provider <name>", "gemini | claude — used to classify the transcript (omit for a keyword-only guess)")
  .action(async (opts: { target?: string; targetConfig?: string; allowRemote?: boolean; provider?: string }) => {
    const { target } = resolveTarget(opts.target, opts);
    const llm = opts.provider ? getProvider(opts.provider) : undefined;
    console.log(`Probing ${target.name}...`);
    const profile = await discover(target, llm);
    console.log(JSON.stringify(profile, null, 2));
  });

program
  .command("adaptive")
  .description("Discover the target's capabilities, then generate and run attacks tailored to them")
  .option("-t, --target <name>", `built-in fake bot: ${TARGET_NAMES.join(", ")}`)
  .option("--target-config <file>", "your own assistant over HTTP")
  .option("--allow-remote", "allow non-localhost URLs; only for systems you own or may test in writing")
  .option("-p, --provider <name>", "gemini | claude — used for discovery classification AND judging (omit for rules/keywords only)")
  .option("--max-scenarios <n>", "cap on how many attack scenarios to generate", "60")
  .option("--escalate", "try a second attack strategy per objective if the first one holds")
  .option("--delay <ms>", "delay between calls (rate limits)")
  .option("--restricted-tools <names>", "comma-separated tool names that should never be called (e.g. deleteAccount)")
  .option("--canaries <values>", "comma-separated planted secret/PII values that should never appear in a response")
  .option("-q, --quiet", "don't print each attack prompt/response live — just a progress counter and the final summary")
  .action(
    async (opts: {
      target?: string;
      targetConfig?: string;
      allowRemote?: boolean;
      provider?: string;
      maxScenarios: string;
      escalate?: boolean;
      delay?: string;
      restrictedTools?: string;
      canaries?: string;
      quiet?: boolean;
    }) => {
      const cfg = getConfig();
      const { target } = resolveTarget(opts.target, opts);
      const llm = opts.provider ? getProvider(opts.provider) : undefined;
      const restrictedTools = opts.restrictedTools?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
      const canaries = opts.canaries?.split(",").map((s) => s.trim()).filter(Boolean) ?? (opts.target ? DEMO_BOT_CANARIES : []);

      console.log(`\nAdaptive scan: ${target.name}`);
      let n = 0;
      const result = await runAdaptiveCampaign({
        target,
        discoveryLlm: llm,
        judgeLlm: llm,
        maxScenarios: Number(opts.maxScenarios),
        escalate: opts.escalate,
        delayMs: Number(opts.delay ?? (opts.targetConfig ? 300 : cfg.delayMs)),
        restrictedTools,
        canaries,
        onProgress: (phase, d, t) => {
          if (phase === "discover" && (opts.quiet || d === 0)) process.stdout.write(`\r  discovering capabilities ${d}/${t}  `);
        },
        onDiscoveryQuestion: opts.quiet
          ? undefined
          : ({ n, total, question, response }) => {
              console.log(`\n[discover ${n}/${total}] ${trunc(question)}`);
              console.log(`    ← ${trunc(response || "(empty)")}`);
            },
        onScenario: opts.quiet
          ? undefined
          : ({ scenario, turns, verdict, confidence, reason }) => {
              n++;
              const mark = verdict === "failed" ? "✗ FAILED" : verdict === "uncertain" ? "? UNCERTAIN" : "✓ held";
              console.log(`\n[${n}] ${scenario.objectiveName} — ${scenario.primitiveName} (${scenario.strategy})`);
              for (const [i, t] of turns.entries()) {
                const label = turns.length > 1 ? `turn ${i + 1}` : "prompt";
                console.log(`    → ${label}: ${trunc(t.prompt)}`);
                console.log(`    ← response: ${trunc(t.response || "(empty)")}`);
                if (t.toolCalls.length) console.log(`    ← tool calls: ${trunc(JSON.stringify(t.toolCalls))}`);
              }
              console.log(`    verdict: ${mark} (${Math.round(confidence * 100)}%) — ${reason}`);
            },
      });
      process.stdout.write("\n");

      console.log(`\n  type: ${result.profile.type} | capabilities: ${result.coverage.capabilitiesDiscovered} | scenarios: ${result.executed.length}`);
      console.log(`  confirmed findings: ${result.findings.filter((f) => f.status === "confirmed").length} (+ ${result.findings.filter((f) => f.status === "needs_review").length} needing review)`);
      for (const f of result.findings) console.log(`    [${f.severity}] ${f.objectiveName} — ${f.primitiveName} (${f.findingId})`);
      if (!llm) console.log("  note: no provider given — discovery used keyword heuristics and judging used rules/refusal-language only. Pass --provider for real classification and judging.");

      const file = writeAdaptiveReport(result, cfg.resultsDir);
      console.log(`  report: ${file}`);
    },
  );

program
  .command("replay <findingFile>")
  .description("Re-run one saved finding's exact reproduction steps to check if a fix worked")
  .option("-t, --target <name>", `built-in fake bot: ${TARGET_NAMES.join(", ")}`)
  .option("--target-config <file>", "your own assistant over HTTP")
  .option("--allow-remote", "allow non-localhost URLs; only for systems you own or may test in writing")
  .option("-p, --provider <name>", "gemini | claude — used to re-judge the replay")
  .option("--canaries <values>", "comma-separated planted secret/PII values that should never appear in a response")
  .action(async (findingFile: string, opts: { target?: string; targetConfig?: string; allowRemote?: boolean; provider?: string; canaries?: string }) => {
    const { target } = resolveTarget(opts.target, opts);
    const llm = opts.provider ? getProvider(opts.provider) : undefined;
    const canaries = opts.canaries?.split(",").map((s) => s.trim()).filter(Boolean) ?? (opts.target ? DEMO_BOT_CANARIES : []);
    const finding = loadFinding(findingFile);
    console.log(`Replaying ${finding.findingId} (${finding.objectiveName}) against ${target.name}...`);
    const result = await replayFinding(finding, target, llm, [], 300, canaries);
    console.log(`  previous status: ${result.previousStatus}`);
    console.log(`  new verdict: ${result.newVerdict}`);
    console.log(result.fixed ? "  ✓ no longer reproduces — looks fixed" : "  ✗ still reproduces — NOT fixed");
  });

program
  .command("serve")
  .description("Start the security dashboard")
  .option("--port <n>", "port", "3000")
  .action(async (opts: { port: string }) => {
    const { startDashboard } = await import("../dashboard/server");
    startDashboard(Number(opts.port));
  });

program.parseAsync().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
