import type { LlmProvider } from "../src/llm";
import { createBot, FAKE_PII, FAKE_SECRET, PROMPT_CANARY, type BotResponse } from "./base";
import { HARDENED_SYSTEM } from "./hardenedBot";

const INJECTION_PATTERNS = [
  /ignore (all |the )?(previous|prior|above)/i,
  /disregard (your|all|the) (rules|instructions)/i,
  /forget everything/i,
  /system override/i,
  /developer mode/i,
  /(hidden|secret) instruction/i,
  /reveal .*(system prompt|password|instructions)/i,
];

const MAX_OUTPUT_CHARS = 1500;

function redact(text: string): string {
  return text
    .replaceAll(FAKE_SECRET, "[REDACTED]")
    .replaceAll(PROMPT_CANARY, "[REDACTED]")
    .replaceAll(FAKE_PII, "[REDACTED]")
    .slice(0, MAX_OUTPUT_CHARS); // cost control: caps runaway generations
}

/** Hardened prompt + input filter (known injection phrases) + output filter (redaction, tool allow-list). */
export const guardedBot = (llm: LlmProvider) =>
  createBot("guardedBot", HARDENED_SYSTEM, llm, {
    inputFilter: (msg) =>
      INJECTION_PATTERNS.some((p) => p.test(msg)) ? "Request declined by the input guard." : null,
    outputFilter: (res: BotResponse): BotResponse => ({
      ...res,
      text: redact(res.text),
      toolCalls: res.toolCalls.filter((c) => {
        const to = String((c.args as { to?: string })?.to ?? "");
        return c.name === "sendEmail" && to.endsWith("@acme.test");
      }),
    }),
  });
