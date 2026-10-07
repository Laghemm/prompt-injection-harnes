import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface Config {
  provider: string;
  judgeProvider?: string;
  geminiKey?: string;
  anthropicKey?: string;
  geminiModel: string;
  claudeModel: string;
  delayMs: number;
  resultsDir: string;
  attacksDir: string;
}

/** Reads settings from the environment. Keys are never logged or written anywhere. */
export function getConfig(): Config {
  const env = process.env;
  return {
    provider: env.LLM_PROVIDER ?? "gemini",
    judgeProvider: env.JUDGE_PROVIDER || undefined,
    geminiKey: env.GEMINI_API_KEY,
    anthropicKey: env.ANTHROPIC_API_KEY,
    geminiModel: env.GEMINI_MODEL ?? "gemini-3.8-flash",
    claudeModel: env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001",
    delayMs: Number(env.REQUEST_DELAY_MS ?? 2000),
    resultsDir: path.join(ROOT, "results"),
    attacksDir: path.join(ROOT, "attacks"),
  };
}
