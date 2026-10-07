import Anthropic from "@anthropic-ai/sdk";
import type { LlmInput, LlmProvider, LlmResponse } from "./types";
import { withRetry } from "./retry";

export class ClaudeProvider implements LlmProvider {
  name = "claude" as const;
  private client: Anthropic;

  constructor(
    apiKey: string,
    public model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete({ system, user, tools }: LlmInput): Promise<LlmResponse> {
    const res = await withRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
        tools: tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool.InputSchema,
        })),
      }),
    );

    if (res.stop_reason === "refusal") {
      return { text: "", toolCalls: [], blocked: true, blockReason: "refusal" };
    }

    let text = "";
    const toolCalls: LlmResponse["toolCalls"] = [];
    for (const block of res.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "tool_use") toolCalls.push({ name: block.name, args: block.input });
    }
    return { text, toolCalls, blocked: false };
  }
}
