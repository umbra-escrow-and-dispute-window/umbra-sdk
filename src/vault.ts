import type {
  AssembledTransaction,
  Result,
  u64,
} from "@stellar/stellar-sdk/contract";
import { deployments, rpcUrls, type NetworkName } from "./deployments.js";
import { SignerRequiredError } from "./errors.js";
import {
  assertValidStellarAddress,
  assertPositiveAmount,
  ValidationError,
} from "./validation.js";
import type { SignTransaction } from "./types.js";

export interface SellerAccountSummary {
  totalCollateral: bigint;
  lockedCollateral: bigint;
  availableCollateral: bigint;
}

export interface LockRecord {
  escrowId: bigint;
  asset: string;
  amount: bigint;
  expiresAt: bigint;
}

export interface VaultOptions {
  network?: NetworkName;
  contractId?: string;
  rpcUrl?: string;
  publicKey?: string;
  signTransaction?: SignTransaction;
}

export class UmbraVault {
  readonly options: VaultOptions;
  readonly contractId: string;
  readonly rpcUrl: string;

  constructor(options: VaultOptions = {}) {
    const network = options.network ?? "testnet";
    this.contractId =
      options.contractId ?? deployments[network]?.escrowContractId ?? "";
    this.rpcUrl = options.rpcUrl ?? rpcUrls[network];
    this.options = { ...options, network };
  }

  /** Validates signer presence for state-changing operations. */
  private requireSigner(): string {
    if (!this.options.publicKey || !this.options.signTransaction) {
      throw new SignerRequiredError(
        "vault operation requires a configured signer",
      );
    }
    return this.options.publicKey;
  }

  /** Deposit collateral into the vault. */
  async deposit(
    seller: string,
    asset: string,
    amount: bigint,
  ): Promise<{ seller: string; asset: string; amount: bigint }> {
    this.requireSigner();
    assertValidStellarAddress(seller, "seller");
    assertValidStellarAddress(asset, "asset");
    assertPositiveAmount(amount, "amount");

    return { seller, asset, amount };
  }

  /** Withdraw unencumbered collateral from the vault. */
  async withdraw(
    seller: string,
    asset: string,
    amount: bigint,
  ): Promise<{ seller: string; asset: string; amount: bigint }> {
    this.requireSigner();
    assertValidStellarAddress(seller, "seller");
    assertValidStellarAddress(asset, "asset");
    assertPositiveAmount(amount, "amount");

    return { seller, asset, amount };
  }

  /** Lock collateral for an instant-release escrow liability. */
  async lockCollateral(
    seller: string,
    asset: string,
    amount: bigint,
    escrowId: bigint,
    expiresAt: bigint,
  ): Promise<{
    seller: string;
    asset: string;
    amount: bigint;
    escrowId: bigint;
    expiresAt: bigint;
  }> {
    this.requireSigner();
    assertValidStellarAddress(seller, "seller");
    assertValidStellarAddress(asset, "asset");
    assertPositiveAmount(amount, "amount");
    if (escrowId <= 0n) {
      throw new ValidationError("escrowId must be positive", "escrowId");
    }
    if (expiresAt <= 0n) {
      throw new ValidationError("expiresAt must be positive", "expiresAt");
    }

    return { seller, asset, amount, escrowId, expiresAt };
  }

  /** Release locked collateral after dispute window expiry. */
  async releaseLock(
    seller: string,
    escrowId: bigint,
  ): Promise<{ seller: string; escrowId: bigint }> {
    this.requireSigner();
    assertValidStellarAddress(seller, "seller");
    if (escrowId <= 0n) {
      throw new ValidationError("escrowId must be positive", "escrowId");
    }

    return { seller, escrowId };
  }

  /** Slash locked collateral following an arbiter dispute verdict. */
  async slashAndRefund(
    seller: string,
    recipient: string,
    escrowId: bigint,
    amount: bigint,
  ): Promise<{
    seller: string;
    recipient: string;
    escrowId: bigint;
    amount: bigint;
  }> {
    this.requireSigner();
    assertValidStellarAddress(seller, "seller");
    assertValidStellarAddress(recipient, "recipient");
    assertPositiveAmount(amount, "amount");
    if (escrowId <= 0n) {
      throw new ValidationError("escrowId must be positive", "escrowId");
    }

    return { seller, recipient, escrowId, amount };
  }
}
