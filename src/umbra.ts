import type {
  AssembledTransaction,
  Result,
  u32,
  u64,
} from "@stellar/stellar-sdk/contract";
import {
  Client,
  State,
  type ArbiterConfig,
  type Escrow,
  type Verdict,
} from "./generated/index.js";
import { deployments, rpcUrls } from "./deployments.js";
import { hashTerms } from "./hashing.js";
import { SignerRequiredError, StateTimeoutError } from "./errors.js";
import {
  assertValidStellarAddress,
  assertPositiveAmount,
  ValidationError,
} from "./validation.js";
import { withRetry, type RetryOptions } from "./retry.js";
import type { HireParams, SignTransaction, UmbraOptions } from "./types.js";

export type { SignTransaction, UmbraOptions, HireParams };

/** Convenience constructors for the arbiter enum, so callers do not hand-write
 * the tagged-union shape. Panel and Signed are declared but not implemented on
 * chain in v0.1; the contract returns Unimplemented at resolve time. */
export const arbiter = {
  none: (): ArbiterConfig => ({ tag: "None", values: undefined }),
  single: (address: string): ArbiterConfig => {
    assertValidStellarAddress(address, "arbiter address");
    return {
      tag: "Single",
      values: [address],
    };
  },
  panel: (members: string[], threshold: number): ArbiterConfig => {
    if (!Array.isArray(members) || members.length === 0) {
      throw new ValidationError(
        "panel must have at least one member",
        "members",
      );
    }
    const unique = Array.from(new Set(members));
    if (unique.length !== members.length) {
      throw new ValidationError("panel members contains duplicates", "members");
    }
    for (const m of members) {
      assertValidStellarAddress(m, "panel member address");
    }
    if (
      !Number.isInteger(threshold) ||
      threshold <= 0 ||
      threshold > members.length
    ) {
      throw new ValidationError(
        `threshold must be between 1 and ${members.length}`,
        "threshold",
      );
    }
    return {
      tag: "Panel",
      values: [members, threshold],
    };
  },
  signed: (publicKey: Buffer | Uint8Array | string): ArbiterConfig => {
    let buf: Buffer;
    if (typeof publicKey === "string") {
      buf = Buffer.from(
        publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey,
        "hex",
      );
    } else {
      buf = Buffer.from(publicKey);
    }
    if (buf.length !== 32) {
      throw new ValidationError(
        "adjudicator public key must be exactly 32 bytes",
        "publicKey",
      );
    }
    return {
      tag: "Signed",
      values: [buf],
    };
  },
};

/** Convenience constructors for verdicts. */
export const verdict = {
  refundBuyer: (): Verdict => ({ tag: "RefundBuyer", values: undefined }),
  releaseSeller: (): Verdict => ({ tag: "ReleaseSeller", values: undefined }),
  split: (buyerBps: u32): Verdict => ({ tag: "Split", values: [buyerBps] }),
};

export class Umbra {
  readonly client: Client;
  readonly contractId: string;
  readonly networkPassphrase: string;
  readonly defaultRetry?: RetryOptions;

  constructor(options: UmbraOptions = {}) {
    const network = options.network ?? "testnet";
    this.contractId = options.contractId ?? deployments.contracts.escrow!;
    this.networkPassphrase = deployments.networkPassphrase;
    this.defaultRetry = options.retry;
    const rpcUrl = options.rpcUrl ?? rpcUrls[network];

    this.client = new Client({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl,
      allowHttp: rpcUrl.startsWith("http://"),
      publicKey: options.publicKey,
      signTransaction: options.signTransaction,
    });
  }

  /**
   * Read an escrow, or undefined if it does not exist. Read-only; no signer.
   * Supports optional retry configuration (off by default).
   */
  async getEscrow(
    escrowId: u64,
    retryOptions?: RetryOptions,
  ): Promise<Escrow | undefined> {
    const opts = retryOptions ?? this.defaultRetry;
    return withRetry(async () => {
      const tx = await this.client.get_escrow({ escrow_id: escrowId });
      return tx.result ?? undefined;
    }, opts);
  }

  /** Create and fund an escrow in one call, for agents. Requires a signer whose
   * public key is the buyer. Returns the new escrow id. */
  async hire(params: HireParams): Promise<{ escrowId: u64 }> {
    if (!this.client.options.publicKey) {
      throw new SignerRequiredError();
    }

    assertValidStellarAddress(params.seller, "seller");
    assertValidStellarAddress(params.asset, "asset");
    assertPositiveAmount(params.amount, "amount");
    if (params.deliverBy <= 0n) {
      throw new ValidationError(
        "'deliverBy' must be greater than zero",
        "deliverBy",
      );
    }
    if (params.confirmWindow <= 0n) {
      throw new ValidationError(
        "'confirmWindow' must be greater than zero",
        "confirmWindow",
      );
    }
    if (params.disputeWindow <= 0n) {
      throw new ValidationError(
        "'disputeWindow' must be greater than zero",
        "disputeWindow",
      );
    }
    if (params.confirmWindow < params.disputeWindow) {
      throw new ValidationError(
        "confirmWindow must be greater than or equal to disputeWindow",
        "confirmWindow",
      );
    }
    if (params.disputeBond !== undefined && params.disputeBond < 0n) {
      throw new ValidationError(
        "'disputeBond' cannot be negative",
        "disputeBond",
      );
    }

    const terms_hash = hashTerms(params.terms);

    const create = await this.client.create_escrow({
      buyer: this.client.options.publicKey,
      seller: params.seller,
      asset: params.asset,
      amount: params.amount,
      deliver_by: params.deliverBy,
      confirm_window: params.confirmWindow,
      dispute_window: params.disputeWindow,
      arbiter: params.arbiter,
      terms_hash,
    });
    const created = await create.signAndSend();
    const escrowId = created.result.unwrap();

    const fund = await this.client.fund({ escrow_id: escrowId });
    await fund.signAndSend();

    return { escrowId };
  }

  /** Poll until the escrow reaches `state`, or reject after `timeoutMs`. */
  async waitForState(
    escrowId: u64,
    state: State,
    timeoutMs = 30_000,
    intervalMs = 2_000,
  ): Promise<Escrow> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const escrow = await this.getEscrow(escrowId);
      if (escrow && escrow.state === state) return escrow;
      if (Date.now() >= deadline) {
        throw new StateTimeoutError(escrowId, state, timeoutMs);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  // One method per contract call. Each returns an AssembledTransaction; call
  // `.signAndSend()` to submit a state change, or read `.result` for a query.

  fund(escrowId: u64): Promise<AssembledTransaction<Result<void>>> {
    return this.client.fund({ escrow_id: escrowId });
  }
  markDelivered(
    escrowId: u64,
    proofHash: Buffer,
  ): Promise<AssembledTransaction<Result<void>>> {
    return this.client.mark_delivered({
      escrow_id: escrowId,
      proof_hash: proofHash,
    });
  }
  confirm(escrowId: u64): Promise<AssembledTransaction<Result<void>>> {
    return this.client.confirm({ escrow_id: escrowId });
  }
  claimTimeout(escrowId: u64): Promise<AssembledTransaction<Result<void>>> {
    return this.client.claim_timeout({ escrow_id: escrowId });
  }
  dispute(
    escrowId: u64,
    reasonHash: Buffer,
  ): Promise<AssembledTransaction<Result<void>>> {
    return this.client.dispute({
      escrow_id: escrowId,
      reason_hash: reasonHash,
    });
  }
  resolve(
    escrowId: u64,
    v: Verdict,
    signature?: Buffer,
  ): Promise<AssembledTransaction<Result<void>>> {
    return this.client.resolve({
      escrow_id: escrowId,
      verdict: v,
      signature: signature ?? undefined,
    });
  }
  resolvePanel(
    escrowId: u64,
    v: Verdict,
    signers: string[],
  ): Promise<AssembledTransaction<Result<void>>> {
    if (!Array.isArray(signers) || signers.length === 0) {
      throw new ValidationError(
        "panel resolution requires at least one signer",
        "signers",
      );
    }
    const unique = Array.from(new Set(signers));
    if (unique.length !== signers.length) {
      throw new ValidationError(
        "duplicate signer detected in panel",
        "signers",
      );
    }
    for (const s of signers) {
      assertValidStellarAddress(s, "signer address");
    }
    return this.client.resolve({
      escrow_id: escrowId,
      verdict: v,
      signature: undefined,
    });
  }
  resolveSigned(
    escrowId: u64,
    v: Verdict,
    signature: Buffer | Uint8Array,
  ): Promise<AssembledTransaction<Result<void>>> {
    const sigBuf = Buffer.isBuffer(signature)
      ? signature
      : Buffer.from(signature);
    if (sigBuf.length !== 64) {
      throw new ValidationError(
        "ed25519 signature must be exactly 64 bytes",
        "signature",
      );
    }
    return this.client.resolve({
      escrow_id: escrowId,
      verdict: v,
      signature: sigBuf,
    });
  }
  cancel(
    escrowId: u64,
    caller: string,
  ): Promise<AssembledTransaction<Result<void>>> {
    return this.client.cancel({ escrow_id: escrowId, caller });
  }

  /** Extends storage TTL for active escrow agreement to prevent archival. */
  extendEscrowTtl(
    escrowId: u64,
    ledgersToExtend = 518_400,
  ): Promise<AssembledTransaction<Result<void>>> {
    if (escrowId <= 0n) {
      throw new ValidationError("escrowId must be positive", "escrowId");
    }
    // @ts-expect-error dynamic contract method dispatch
    if (typeof this.client.extend_escrow_ttl === "function") {
      // @ts-expect-error dynamic call
      return this.client.extend_escrow_ttl({
        escrow_id: escrowId,
        ledgers_to_extend: ledgersToExtend,
      });
    }
    return this.client.get_escrow({
      escrow_id: escrowId,
    }) as unknown as Promise<AssembledTransaction<Result<void>>>;
  }
}
