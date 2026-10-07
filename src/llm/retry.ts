export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit/i.test(msg);
}

/** Retries rate-limit / overload errors with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseMs = 1500 }: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const wait = baseMs * 2 ** attempt;
      console.log(`  retrying in ${wait}ms (attempt ${attempt + 1}/${retries}): ${(err as Error).message}`);
      await sleep(wait);
    }
  }
}
