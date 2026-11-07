import { describe, expect, it } from "vitest";
import { estimateTransaction } from "../src/index.js";

describe("estimateTransaction helper", () => {
  it("extracts fees, cpu instructions, bytes, and footprint counts", () => {
    const mockTx = {
      raw: { fee: "250" },
      simulationData: {
        minResourceFee: 1500,
        transactionData: {
          resources: {
            instructions: 125000,
            readBytes: 4096,
            writeBytes: 1024,
          },
          footprint: {
            readOnly: [{ key: "read1" }, { key: "read2" }],
            readWrite: [{ key: "write1" }],
          },
        },
      },
    };

    const est = estimateTransaction(
      mockTx as unknown as Parameters<typeof estimateTransaction>[0],
    );

    expect(est.baseFee).toBe("250");
    expect(est.resourceFee).toBe("1500");
    expect(est.totalFee).toBe("1750");
    expect(est.cpuInstructions).toBe(125000);
    expect(est.readBytes).toBe(4096);
    expect(est.writeBytes).toBe(1024);
    expect(est.footprint).toEqual({
      readOnly: 2,
      readWrite: 1,
      totalKeys: 3,
    });
  });

  it("handles getter functions on transactionData", () => {
    const mockTx = {
      raw: { fee: 100 },
      simulationData: {
        resourceFee: 800,
        transactionData: {
          resources: () => ({
            instructions: () => 50000,
            readBytes: () => 200,
            writeBytes: () => 300,
          }),
          footprint: () => ({
            readOnly: () => [1],
            readWrite: () => [2, 3],
          }),
        },
      },
    };

    const est = estimateTransaction(
      mockTx as unknown as Parameters<typeof estimateTransaction>[0],
    );
    expect(est.totalFee).toBe("900");
    expect(est.cpuInstructions).toBe(50000);
    expect(est.footprint.totalKeys).toBe(3);
  });

  it("throws when simulation data is missing", () => {
    expect(() =>
      estimateTransaction({ raw: { fee: "100" } } as unknown as Parameters<
        typeof estimateTransaction
      >[0]),
    ).toThrow(/Transaction simulation data is missing/);
  });

  it("throws for null or invalid transaction parameter", () => {
    expect(() =>
      estimateTransaction(
        null as unknown as Parameters<typeof estimateTransaction>[0],
      ),
    ).toThrow(/Invalid transaction/);
  });
});
