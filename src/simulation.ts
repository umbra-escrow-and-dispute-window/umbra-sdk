import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";

/** Breakdown of ledger keys accessed in read-only and read-write modes. */
export interface ResourceFootprint {
  readOnly: number;
  readWrite: number;
  totalKeys: number;
}

/** Estimated fees, compute instructions, and storage footprints from simulation. */
export interface TransactionEstimation {
  /** Base network transaction fee in stroops. */
  baseFee: string;
  /** Soroban resource fee in stroops. */
  resourceFee: string;
  /** Total estimated fee (base + resource) in stroops. */
  totalFee: string;
  /** Number of Soroban virtual CPU instructions estimated. */
  cpuInstructions: number;
  /** Estimated bytes of ledger data read. */
  readBytes: number;
  /** Estimated bytes of ledger data written. */
  writeBytes: number;
  /** Count of ledger keys in the footprint. */
  footprint: ResourceFootprint;
}

/**
 * Extracts fee and resource estimation from an AssembledTransaction prior to signing and sending.
 * Throws an error if simulation data is unavailable.
 */
interface SimulationLike {
  minResourceFee?: string | number | bigint;
  resourceFee?: string | number | bigint;
  transactionData?: {
    resources?:
      | {
          instructions?: number | bigint | (() => number | bigint);
          readBytes?: number | bigint | (() => number | bigint);
          writeBytes?: number | bigint | (() => number | bigint);
        }
      | (() => {
          instructions?: number | bigint | (() => number | bigint);
          readBytes?: number | bigint | (() => number | bigint);
          writeBytes?: number | bigint | (() => number | bigint);
        });
    footprint?:
      | {
          readOnly?: unknown[] | (() => unknown[]);
          readWrite?: unknown[] | (() => unknown[]);
        }
      | (() => {
          readOnly?: unknown[] | (() => unknown[]);
          readWrite?: unknown[] | (() => unknown[]);
        });
  };
}

/**
 * Extracts fee and resource estimation from an AssembledTransaction prior to signing and sending.
 * Throws an error if simulation data is unavailable.
 */
export function estimateTransaction(
  tx:
    | AssembledTransaction<unknown>
    | { simulationData?: unknown; raw?: { fee?: string | number } },
): TransactionEstimation {
  if (!tx || typeof tx !== "object") {
    throw new Error(
      "Invalid transaction: expected an AssembledTransaction object",
    );
  }

  const sim = (tx as { simulationData?: SimulationLike }).simulationData;
  if (!sim) {
    throw new Error(
      "Transaction simulation data is missing; ensure the transaction was simulated",
    );
  }

  const rawFee = (tx as { raw?: { fee?: string | number } }).raw?.fee;
  const baseFee = String(rawFee ?? "100");

  let resourceFeeStr = "0";
  let cpuInstructions = 0;
  let readBytes = 0;
  let writeBytes = 0;
  let readOnlyCount = 0;
  let readWriteCount = 0;

  if (sim.minResourceFee !== undefined) {
    resourceFeeStr = String(sim.minResourceFee);
  } else if (sim.resourceFee !== undefined) {
    resourceFeeStr = String(sim.resourceFee);
  }

  const txData = sim.transactionData;
  if (txData) {
    const rawRes =
      typeof txData.resources === "function"
        ? txData.resources()
        : txData.resources;
    if (rawRes) {
      const inst =
        typeof rawRes.instructions === "function"
          ? rawRes.instructions()
          : rawRes.instructions;
      const rb =
        typeof rawRes.readBytes === "function"
          ? rawRes.readBytes()
          : rawRes.readBytes;
      const wb =
        typeof rawRes.writeBytes === "function"
          ? rawRes.writeBytes()
          : rawRes.writeBytes;

      cpuInstructions = Number(inst ?? 0);
      readBytes = Number(rb ?? 0);
      writeBytes = Number(wb ?? 0);
    }

    const rawFp =
      typeof txData.footprint === "function"
        ? txData.footprint()
        : txData.footprint;
    if (rawFp) {
      const ro =
        typeof rawFp.readOnly === "function"
          ? rawFp.readOnly()
          : rawFp.readOnly;
      const rw =
        typeof rawFp.readWrite === "function"
          ? rawFp.readWrite()
          : rawFp.readWrite;

      readOnlyCount = Array.isArray(ro) ? ro.length : 0;
      readWriteCount = Array.isArray(rw) ? rw.length : 0;
    }
  }

  const totalFee = (BigInt(baseFee) + BigInt(resourceFeeStr)).toString();

  return {
    baseFee,
    resourceFee: resourceFeeStr,
    totalFee,
    cpuInstructions,
    readBytes,
    writeBytes,
    footprint: {
      readOnly: readOnlyCount,
      readWrite: readWriteCount,
      totalKeys: readOnlyCount + readWriteCount,
    },
  };
}
