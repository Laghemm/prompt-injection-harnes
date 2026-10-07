import { GoogleGenAI } from "@google/genai";
import type { LlmInput, LlmProvider, LlmResponse } from "./types";
import { withRetry } from "./retry";

const BLOCKING_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

export class GeminiProvider implements LlmProvider {
  name = "gemini" as const;
  private ai: GoogleGenAI;

  constructor(
    apiKey: string,
    public model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete({ system, user, tools }: LlmInput): Promise<LlmResponse> {
    const res = await withRetry(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          tools: tools?.length
            ? [
                {
                  functionDeclarations: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.parameters,
                  })),
                },
              ]
            : undefined,
        },
      }),
    );

    const blockReason = res.promptFeedback?.blockReason;
    const candidate = res.candidates?.[0];
    const finish = candidate?.finishReason ? String(candidate.finishReason) : undefined;
    if (blockReason || (finish && BLOCKING_FINISH.has(finish)) || !candidate) {
      return { text: "", toolCalls: [], blocked: true, blockReason: String(blockReason ?? finish ?? "no candidate") };
    }

    let text = "";
    const toolCalls: LlmResponse["toolCalls"] = [];
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) text += part.text;
      if (part.functionCall?.name) toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
    }
    return { text, toolCalls, blocked: false };
  }
}
