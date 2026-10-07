import type { LlmProvider } from "../src/llm";
import type { Target } from "./base";
import { guardedBot } from "./guardedBot";
import { hardenedBot } from "./hardenedBot";
import { weakBot } from "./weakBot";

export const TARGET_NAMES = ["weakBot", "hardenedBot", "guardedBot"] as const;

export function createTarget(name: string, llm: LlmProvider): Target {
  switch (name) {
    case "weakBot":
      return weakBot(llm);
    case "hardenedBot":
      return hardenedBot(llm);
    case "guardedBot":
      return guardedBot(llm);
    default:
      throw new Error(`Unknown target "${name}". Available: ${TARGET_NAMES.join(", ")}`);
  }
}
