import fs from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { withRetry } from "../src/llm/retry";
import { buildUserMessage, type BotResponse, type Target } from "./base";

const HttpConfig = z.object({
  name: z.string().default("customAssistant"),
  url: z.string(),
  method: z.string().default("POST"),
  /** Values may reference environment variables as ${NAME}, so tokens never live in the file. */
  headers: z.record(z.string(), z.string()).default({}),
  /** Request body template. {{prompt}} and {{context}} are replaced with JSON-escaped text. */
  body: z.string(),
  /** Dot path to the assistant's reply text in the JSON response, e.g. "reply" or "choices.0.message.content". */
  responsePath: z.string(),
  /** Optional dot path to an array of tool calls: [{ name, args }]. */
  toolCallsPath: z.string().optional(),
  timeoutMs: z.number().default(60000),
  /** Optional "log in first" step for assistants protected by a username and password. */
  login: z
    .object({
      url: z.string(),
      method: z.string().default("POST"),
      headers: z.record(z.string(), z.string()).default({}),
      /** Login body template. {{username}} and {{password}} are replaced with JSON-escaped values. */
      body: z.string(),
      /** Dot path to the token in the login response, e.g. "token" or "data.access_token". */
      tokenPath: z.string(),
      /** Header the chat endpoint expects the token in, and an optional prefix such as "Bearer ". */
      headerName: z.string().default("Authorization"),
      headerPrefix: z.string().default("Bearer "),
      /** Use test credentials of a test account. Can be "${ENV_VAR}" to read them from the environment. */
      username: z.string(),
      password: z.string(),
    })
    .optional(),
});
export type HttpConfig = z.infer<typeof HttpConfig>;

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Sends one JSON request. Error messages never include request bodies, tokens or response bodies. */
async function sendJson(url: string, method: string, headers: Record<string, string>, body: string, timeoutMs: number) {
  const host = new URL(url).host;
  logRequest(method, url, headers, body);
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).name;
    console.log(`← (no response) ${code}`);
    throw new Error(`Could not reach ${host} (${code}). Is the assistant running and the URL correct?`);
  }
  const raw = await res.text();
  logResponse(res.status, raw);
  if (!res.ok) throw new HttpError(`HTTP ${res.status} from ${host}: ${trunc(raw, 200)}`, res.status);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${host} did not return JSON. Check the URL and response settings.`);
  }
}

/** Only a value that is entirely "${NAME}" is read from the environment, so passwords containing "${" still work. */
const credential = (v: string) => (/^\$\{\w+\}$/.test(v) ? expandEnv(v) : v);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

function expandEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_m, name: string) => {
    const v = process.env[name];
    if (v === undefined) throw new Error(`Environment variable ${name} is not set (referenced in the target config).`);
    return v;
  });
}

const jsonEscape = (s: string) => JSON.stringify(s).slice(1, -1);

export function getPath(obj: unknown, dotPath: string): unknown {
  return dotPath
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((cur, key) => (cur == null ? undefined : (cur as Record<string, unknown>)[key]), obj);
}

const SENSITIVE_HEADER = /auth|token|cookie|key|secret/i;
const trunc = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}... (${s.length} chars)` : s);

/** Prints each outgoing request and its response to the terminal running the server, for debugging. Header and body values that look sensitive are never printed. */
function logRequest(method: string, url: string, headers: Record<string, string>, body: string) {
  const safeHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, SENSITIVE_HEADER.test(k) ? "<redacted>" : v]));
  console.log(`\n→ ${method} ${url}`);
  console.log(`  headers: ${JSON.stringify(safeHeaders)}`);
  console.log(`  body: ${trunc(body)}`);
}
function logResponse(status: number, body: string) {
  console.log(`← ${status}`);
  console.log(`  body: ${trunc(body)}`);
}

function toToolCalls(raw: unknown): BotResponse["toolCalls"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    const item = c as Record<string, any>;
    return {
      name: String(item.name ?? item.function?.name ?? "unknown"),
      args: item.args ?? item.arguments ?? item.function?.arguments ?? {},
    };
  });
}

/**
 * Wraps an HTTP chat endpoint as a test target.
 * Only localhost is allowed unless allowRemote is set; use that only for systems you own or may test in writing.
 */
export function createHttpTarget(
  configPath: string,
  opts: { allowRemote?: boolean } = {},
): { target: Target; host: string } {
  return createHttpTargetFromConfig(parse(fs.readFileSync(configPath, "utf8")), opts);
}

/** Same as createHttpTarget but takes the config as an object (used by the dashboard form). */
export function createHttpTargetFromConfig(
  raw: unknown,
  { allowRemote = false }: { allowRemote?: boolean } = {},
): { target: Target; host: string } {
  const cfg = HttpConfig.parse(raw);
  const url = expandEnv(cfg.url);
  if (!isLocalUrl(url) && !allowRemote) {
    throw new Error(
      `Refusing to test ${new URL(url).host}: only localhost is allowed by default. ` +
        `If you own this system or have written permission to test it, confirm that (checkbox in the dashboard, or --allow-remote on the CLI).`,
    );
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  for (const [k, v] of Object.entries(cfg.headers)) {
    for (const existing of Object.keys(headers)) if (existing.toLowerCase() === k.toLowerCase()) delete headers[existing];
    headers[k] = expandEnv(v);
  }
  const usesContext = cfg.body.includes("{{context}}");

  const target: Target = {
    name: cfg.name,
    async respond(userInput, context) {
      const prompt = usesContext ? userInput : buildUserMessage(userInput, context);
      const body = cfg.body
        .replaceAll("{{prompt}}", jsonEscape(prompt))
        .replaceAll("{{context}}", jsonEscape(context ?? ""));

      const json = await withRetry(() => sendJson(url, cfg.method, headers, body, cfg.timeoutMs));

      const text = getPath(json, cfg.responsePath);
      return {
        text: typeof text === "string" ? text : text == null ? "" : JSON.stringify(text),
        toolCalls: cfg.toolCallsPath ? toToolCalls(getPath(json, cfg.toolCallsPath)) : [],
        blocked: false,
      };
    },
  };
  return { target, host: new URL(url).host };
}
