import type { i128, u64 } from "@stellar/stellar-sdk/contract";
import type { ArbiterConfig } from "./generated/index.js";
import type { JsonValue } from "./hashing.js";
import type { NetworkName } from "./deployments.js";
import type { RetryOptions } from "./retry.js";

/**
 * Signs a transaction envelope. Matches the Stellar SDK contract signer shape;
 * `contract.basicNodeSigner(keypair, passphrase)` produces one for a script.
 */
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
  /** Configurable retry policy for RPC read calls. Off by default. */
  retry?: RetryOptions;
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
