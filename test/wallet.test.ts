import { describe, expect, it } from "vitest";
import {
  createWalletSigner,
  type BrowserWalletSignerLike,
} from "../src/index.js";

describe("createWalletSigner adapter", () => {
  it("adapts a wallet object returning a signed XDR string", async () => {
    const mockWallet = {
      signTransaction: async (xdr: string) => `SIGNED_${xdr}`,
    };

    const signer = createWalletSigner(mockWallet, "GDEFAULT_ADDRESS");
    const result = await signer("TEST_XDR");

    expect(result).toEqual({
      signedTxXdr: "SIGNED_TEST_XDR",
      signerAddress: "GDEFAULT_ADDRESS",
    });
  });

  it("adapts a wallet object returning an object with signedTxXdr", async () => {
    const mockWallet = {
      signTransaction: async (xdr: string) => ({
        signedTxXdr: `OBJ_SIGNED_${xdr}`,
        signerAddress: "GWALLET_ADDRESS",
      }),
    };

    const signer = createWalletSigner(mockWallet);
    const result = await signer("TEST_XDR");

    expect(result).toEqual({
      signedTxXdr: "OBJ_SIGNED_TEST_XDR",
      signerAddress: "GWALLET_ADDRESS",
    });
  });

  it("adapts a direct raw signer function", async () => {
    const rawFn = async (xdr: string) => `RAW_${xdr}`;
    const signer = createWalletSigner(rawFn);
    const result = await signer("TEST_XDR", { address: "GCALLER_ADDRESS" });

    expect(result).toEqual({
      signedTxXdr: "RAW_TEST_XDR",
      signerAddress: "GCALLER_ADDRESS",
    });
  });

  it("throws if an invalid wallet object is supplied", async () => {
    const badSigner = createWalletSigner(
      {} as unknown as BrowserWalletSignerLike,
    );
    await expect(badSigner("XDR")).rejects.toThrow(/Invalid wallet signer/);
  });

  it("throws if the wallet returns an invalid payload", async () => {
    const badWallet = {
      signTransaction: (async () =>
        12345) as unknown as BrowserWalletSignerLike["signTransaction"],
    };
    const signer = createWalletSigner(badWallet);
    await expect(signer("XDR")).rejects.toThrow(/unexpected signature format/);
  });
});
