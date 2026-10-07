import { getConfig } from "../config";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

export type { LlmProvider, LlmResponse, ToolDef } from "./types";

/** Picks the provider by name. Nothing else in the project knows which one is in use. */
export function getProvider(name?: string): LlmProvider {
  const cfg = getConfig();
  const which = name ?? cfg.provider;
  switch (which) {
    case "gemini":
      if (!cfg.geminiKey) throw new Error("GEMINI_API_KEY is missing. Add it to your local .env file (or use --provider mock).");
      return new GeminiProvider(cfg.geminiKey, cfg.geminiModel);
    case "claude":
      if (!cfg.anthropicKey) throw new Error("ANTHROPIC_API_KEY is missing. Add it to your local .env file.");
      return new ClaudeProvider(cfg.anthropicKey, cfg.claudeModel);
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown provider "${which}". Use gemini, claude or mock.`);
  }
}
