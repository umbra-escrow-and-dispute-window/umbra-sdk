import { describe, expect, it } from "vitest";
import { withRetry } from "../src/index.js";

describe("withRetry helper", () => {
  it("returns result on first attempt when operation succeeds", async () => {
    let calls = 0;
    const res = await withRetry(async () => {
      calls++;
      return "success";
    });
    expect(res).toBe("success");
    expect(calls).toBe(1);
  });

  it("fails immediately when maxRetries is 0 (default)", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    expect(calls).toBe(1);
  });

  it("retries on transient failure and resolves upon success", async () => {
    let attempts = 0;
    const res = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("temporary RPC timeout");
        }
        return { data: "recovered" };
      },
      { maxRetries: 3, initialDelayMs: 5, maxDelayMs: 20 },
    );

    expect(res).toEqual({ data: "recovered" });
    expect(attempts).toBe(3);
  });

  it("throws the final error when retry limit is exceeded", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error(`rate limited ${attempts}`);
        },
        { maxRetries: 2, initialDelayMs: 5, maxDelayMs: 20 },
      ),
    ).rejects.toThrow("rate limited 3");
    expect(attempts).toBe(3);
  });

  it("halts early when shouldRetry returns false", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err = Object.assign(new Error("fatal auth error"), {
            status: 401,
          });
          throw err;
        },
        {
          maxRetries: 5,
          initialDelayMs: 5,
          shouldRetry: (err) => (err as { status?: number }).status !== 401,
        },
      ),
    ).rejects.toThrow("fatal auth error");
    expect(attempts).toBe(1);
  });
});
