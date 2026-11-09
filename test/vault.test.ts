import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  UmbraVault,
  SignerRequiredError,
  ValidationError,
} from "../src/index.js";

const kp = Keypair.random();
const recipientKp = Keypair.random();
const assetId = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("UmbraVault client", () => {
  it("rejects operations when signer is missing", async () => {
    const vault = new UmbraVault();

    await expect(
      vault.deposit(kp.publicKey(), assetId, 1000n),
    ).rejects.toThrowError(SignerRequiredError);

    await expect(
      vault.withdraw(kp.publicKey(), assetId, 500n),
    ).rejects.toThrowError(SignerRequiredError);
  });

  it("validates parameters with configured signer", async () => {
    const vault = new UmbraVault({
      publicKey: kp.publicKey(),
      signTransaction: async (xdr) => ({ signedTxXdr: xdr }),
    });

    // Valid deposit
    const dep = await vault.deposit(kp.publicKey(), assetId, 1000n);
    expect(dep.amount).toBe(1000n);

    // Negative amount rejected
    await expect(
      vault.deposit(kp.publicKey(), assetId, -10n),
    ).rejects.toThrowError(ValidationError);

    // Invalid address rejected
    await expect(
      vault.deposit("bad-address", assetId, 100n),
    ).rejects.toThrowError(ValidationError);

    // Lock validation
    const lock = await vault.lockCollateral(
      kp.publicKey(),
      assetId,
      500n,
      1n,
      100_000n,
    );
    expect(lock.amount).toBe(500n);
    expect(lock.escrowId).toBe(1n);

    // Release lock
    const release = await vault.releaseLock(kp.publicKey(), 1n);
    expect(release.escrowId).toBe(1n);

    // Slash and refund
    const slash = await vault.slashAndRefund(
      kp.publicKey(),
      recipientKp.publicKey(),
      1n,
      250n,
    );
    expect(slash.amount).toBe(250n);
    expect(slash.recipient).toBe(recipientKp.publicKey());
  });
});
