import { describe, expect, it } from "vitest";
import { getProvider } from "../src/llm";
import { withRetry } from "../src/llm/retry";

describe("withRetry", () => {
  it("retries rate-limit errors then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        if (++calls < 3) throw new Error("429 RESOURCE_EXHAUSTED");
        return "ok";
      },
      { baseMs: 1 },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });
  it("does not retry other errors", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("invalid argument");
        },
        { baseMs: 1 },
      ),
    ).rejects.toThrow("invalid argument");
    expect(calls).toBe(1);
  });
});

describe("getProvider", () => {
  it("returns the mock provider offline", () => {
    expect(getProvider("mock").name).toBe("mock");
  });
  it("rejects unknown providers", () => {
    expect(() => getProvider("nope")).toThrow(/Unknown provider/);
  });
});
