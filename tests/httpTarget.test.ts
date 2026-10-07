import express from "express";
import fs from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpTarget, getPath, isLocalUrl } from "../targets/httpTarget";

let server: Server;
let port: number;
let lastBody: any;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-"));

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post("/chat", (req, res) => {
    lastBody = req.body;
    res.json({ data: { reply: `echo: ${req.body.message}` }, calls: [{ function: { name: "sendEmail", arguments: { to: "a@evil.test" } } }] });
  });
  await new Promise<void>((r) => (server = app.listen(0, "127.0.0.1", () => r())));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

const writeCfg = (url: string, extra = "") => {
  const file = path.join(tmp, `cfg-${Math.random()}.yaml`);
  fs.writeFileSync(
    file,
    `name: t\nurl: ${url}\nbody: '{"message": "{{prompt}}", "context": "{{context}}"}'\nresponsePath: data.reply\ntoolCallsPath: calls\n${extra}`,
  );
  return file;
};

describe("httpTarget", () => {
  it("sends JSON-escaped prompts and parses reply and tool calls", async () => {
    const { target } = createHttpTarget(writeCfg(`http://127.0.0.1:${port}/chat`));
    const res = await target.respond('say "hi"\nnow', "doc text");
    expect(lastBody).toEqual({ message: 'say "hi"\nnow', context: "doc text" });
    expect(res.text).toBe('echo: say "hi"\nnow');
    expect(res.toolCalls).toEqual([{ name: "sendEmail", args: { to: "a@evil.test" } }]);
  });
  it("refuses remote hosts unless allowed", () => {
    expect(() => createHttpTarget(writeCfg("https://example.com/chat"))).toThrow(/only localhost/);
    expect(() => createHttpTarget(writeCfg("https://example.com/chat"), { allowRemote: true })).not.toThrow();
  });
  it("expands env vars and fails clearly when missing", () => {
    const file = writeCfg(`http://127.0.0.1:${port}/chat`, "headers:\n  Authorization: Bearer ${NOPE_NOT_SET}\n");
    expect(() => createHttpTarget(file)).toThrow(/NOPE_NOT_SET/);
  });
});

describe("helpers", () => {
  it("getPath handles arrays", () => {
    expect(getPath({ a: [{ b: "x" }] }, "a.0.b")).toBe("x");
    expect(getPath({}, "a.b")).toBeUndefined();
  });
  it("isLocalUrl", () => {
    expect(isLocalUrl("http://localhost:3000/x")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1/x")).toBe(true);
    expect(isLocalUrl("https://evil.com/x")).toBe(false);
  });
});
