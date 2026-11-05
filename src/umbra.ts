import type {
  AssembledTransaction,
  i128,
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
import { deployments, rpcUrls, type NetworkName } from "./deployments.js";
import { hashTerms, type JsonValue } from "./hashing.js";

/** Signs a transaction envelope. Matches the Stellar SDK contract signer shape;
 * `contract.basicNodeSigner(keypair, passphrase)` produces one for a script. */
export type SignTransaction = (
  xdr: string,
  opts?: {
    networkPassphrase?: string;
    address?: string;
    submit?: boolean;
    submitUrl?: string;
  },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

export interface UmbraOptions {
  /** Defaults to "testnet". */
  network?: NetworkName;
  /** Defaults to the escrow id in the vendored deployments file. */
  contractId?: string;
  /** Defaults to the network's public RPC. */
  rpcUrl?: string;
  /** Source account for signed calls. Required to send, not to read. */
  publicKey?: string;
  /** Required to send, not to read. */
  signTransaction?: SignTransaction;
}

export interface HireParams {
  seller: string;
  asset: string;
  amount: i128;
  deliverBy: u64;
  confirmWindow: u64;
  disputeWindow: u64;
  arbiter: ArbiterConfig;
  /** The terms document. It is canonicalised and hashed; only the hash is sent. */
  terms: JsonValue;
}

/** Convenience constructors for the arbiter enum, so callers do not hand-write
 * the tagged-union shape. Panel and Signed are declared but not implemented on
 * chain in v0.1; the contract returns Unimplemented at resolve time. */
export const arbiter = {
  none: (): ArbiterConfig => ({ tag: "None", values: undefined }),
  single: (address: string): ArbiterConfig => ({
    tag: "Single",
    values: [address],
  }),
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

  constructor(options: UmbraOptions = {}) {
    const network = options.network ?? "testnet";
    this.contractId = options.contractId ?? deployments.contracts.escrow!;
    this.networkPassphrase = deployments.networkPassphrase;
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

  /** Read an escrow, or undefined if it does not exist. Read-only; no signer. */
  async getEscrow(escrowId: u64): Promise<Escrow | undefined> {
    const tx = await this.client.get_escrow({ escrow_id: escrowId });
    return tx.result ?? undefined;
  }

  /** Create and fund an escrow in one call, for agents. Requires a signer whose
   * public key is the buyer. Returns the new escrow id. */
  async hire(params: HireParams): Promise<{ escrowId: u64 }> {
    if (!this.client.options.publicKey) {
      throw new Error(
        "hire requires a signer: set publicKey and signTransaction",
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
        throw new Error(
          `escrow ${escrowId} did not reach ${State[state]} within ${timeoutMs}ms`,
        );
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
  cancel(
    escrowId: u64,
    caller: string,
  ): Promise<AssembledTransaction<Result<void>>> {
    return this.client.cancel({ escrow_id: escrowId, caller });
  }
}
