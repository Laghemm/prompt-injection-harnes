# AI Security — Adaptive Testing Platform

Point it at an AI assistant's chat API, and it **discovers what the assistant can do first**, then generates and runs attacks tailored to that — prompt injection, jailbreaks, cross-user data access, tool misuse, privilege escalation and more — instead of firing a fixed list of prompts at everything. Node.js + TypeScript backend, React dashboard, works with **Gemini** or **Claude**.

> For authorized testing of assistants you own or have written permission to test. It finds known weaknesses; it cannot prove an assistant is safe. Use a staging copy with fake data where possible.

## How it works

```
discover(target)          8 safe recon questions → an AssistantProfile
     │                    (type, capabilities, data classes, tools, risk)
     ▼
planAttacks(profile)      ranks 10 security objectives × 16 attack primitives
     │                    by relevance to THIS assistant, caps the plan
     ▼
generateScenario(...)     turns each (objective, primitive, capability) into
     │                    concrete attack prompts
     ▼
execute against target    real HTTP calls to the assistant's chat API
     ▼
judgeScenario(...)        evidence-based verdict: refusal/compliance language,
     │                    restricted tool calls, planted canaries, optional LLM judge
     ▼
Finding                   objective, evidence, full conversation, exact
                          reproduction steps, fix hint, confirmed vs. needs-review
```

Every campaign also computes **attack-surface coverage** (% of relevant objectives actually tested, not just "N attacks ran") and writes a JSON + Markdown report to `results/findings/`.

## Quick start

```bash
npm install
npm run build:webapp     # builds the React dashboard once
npm run serve            # http://localhost:3000
```

Open the dashboard, go to **Campaigns → New**, pick a built-in practice bot (`weakBot`/`hardenedBot`/`guardedBot`) or your own assistant's URL, and run a campaign. No API key needed for a first offline test — use the `mock` provider (a keyword simulation, not a real model) to see the full flow without any setup:

```bash
npm run harness -- adaptive --target weakBot --provider mock
```

With a real model, copy `.env.example` to `.env` and add your Gemini key (from Google AI Studio), then:

```bash
npm run harness -- discover --target weakBot --provider gemini   # profile only, no attacks
npm run harness -- adaptive --target weakBot --provider gemini   # full campaign
npm run harness -- replay results/findings/F-xxxxxxxx.json --target weakBot --provider gemini
```

## Test your own assistant

```bash
npm run harness -- adaptive --target-config examples/my-assistant.http.yaml --provider gemini
```

Copy `examples/sample-assistant.http.yaml` as a template: set `url`, the request `body` (with `{{prompt}}` where the attack text goes), and `responsePath` (where the reply sits in the JSON response). Auth tokens go in environment variables (`${MY_TOKEN}`), never in the file. Only `localhost` is allowed by default — `--allow-remote` (or the dashboard's ownership checkbox) is for systems you own or have written permission to test.

**Canaries:** attacks look for planted fake values to detect a leak. The built-in demo bots have them automatically (`FAKE-SECRET-12345`, `CANARY-7731`, `FAKE-PII-JD-2002`). For your own assistant, add these to its staging system prompt, or pass your own via `--canaries val1,val2`. Without canaries, detection still works through refusal/compliance language and restricted tool calls — see `--restricted-tools`.

## The dashboard

`npm run dev:webapp` runs it with hot reload (proxies `/api` to the Express backend on port 3000, started separately with `npm run serve`). Pages: **Overview** (security score, trend, top findings), **Assistants**, **Campaigns** (wizard + live progress), **Findings** (full conversation, evidence, one-click **Replay** against a live target), **Attack Lab** (preview generated scenarios), **Coverage**, **Regressions**, **Reports**. Ctrl+K for a command palette.

## The mock provider

`--provider mock` is an offline **keyword simulation**, used for tests and for trying the tool without a key. Its scores say nothing about real models. Use Gemini or Claude for real measurements.

## Limits, stated plainly

- A clean result means these attacks held — not proof the assistant is unbreakable.
- Without an LLM judge, discovery falls back to keyword heuristics and judging relies on refusal/compliance language plus canaries — less nuanced than an LLM reading intent.
- No capability graph, attack-lineage tracking, multi-turn session state, WebSocket live updates, PDF export, or persisted regression history yet. Full list in [docs/CONCEPTION.md](docs/CONCEPTION.md) (local only, not committed).
- LLM output varies between runs; a single pass isn't a guarantee.

## Project layout

`src/discovery` `attack` `planner` `judge` `risk` `regression` `adaptive` (the engine) · `targets/` (fake demo bots + the generic HTTP target) · `src/llm/` (Gemini/Claude/mock providers) · `dashboard/` (Express API) · `webapp/` (React dashboard) · `tests/` (Vitest)

```bash
npm test && npm run typecheck
cd webapp && npx tsc -b && npm run build
```
