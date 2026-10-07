/**
 * A tiny local "AI assistant" to practise on. It is deliberately weak and holds the same fake canary
 * values the attacks look for. Replace it with your own assistant (staging copy, fake data) to test that.
 *
 *   npm run sample-assistant                 # uses LLM_PROVIDER (default gemini)
 *   PROVIDER=mock npm run sample-assistant   # offline simulation
 */
import express from "express";
import { getProvider } from "../src/llm";
import { TOOLS } from "../targets/base";
import { WEAK_SYSTEM } from "../targets/weakBot";

const llm = getProvider(process.env.PROVIDER);
const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/chat", async (req, res) => {
  const { message, context } = req.body as { message?: string; context?: string };
  if (typeof message !== "string") return res.status(400).json({ error: "message (string) is required" });
  const user = context ? `${message}\n\n<document>\n${context}\n</document>` : message;
  try {
    const out = await llm.complete({ system: WEAK_SYSTEM, user, tools: TOOLS });
    res.json({ reply: out.text, toolCalls: out.toolCalls });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "model error" });
  }
});

const port = Number(process.env.ASSISTANT_PORT ?? 8787);
app.listen(port, "127.0.0.1", () => console.log(`Sample assistant on http://127.0.0.1:${port}/chat (${llm.name})`));
