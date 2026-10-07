export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool arguments. */
  parameters: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  toolCalls: { name: string; args: unknown }[];
  /** True if the provider's safety filter refused the input or output. */
  blocked: boolean;
  blockReason?: string;
}

export interface LlmInput {
  system: string;
  user: string;
  tools?: ToolDef[];
}

export interface LlmProvider {
  name: "gemini" | "claude" | "mock";
  model: string;
  complete(input: LlmInput): Promise<LlmResponse>;
}
