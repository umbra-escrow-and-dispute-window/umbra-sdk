import type { SignTransaction } from "./types.js";

/** Minimal interface representing Stellar Wallets Kit and browser extension signers. */
export interface BrowserWalletSignerLike {
  signTransaction: (
    xdr: string,
    opts?: {
      networkPassphrase?: string;
      address?: string;
    },
  ) => Promise<string | { signedTxXdr: string; signerAddress?: string }>;
  publicKey?: string | (() => Promise<string>);
}

/** Function signature for direct signing callbacks from browser wallet extensions. */
export type RawSignerFunction = (
  xdr: string,
  opts?: {
    networkPassphrase?: string;
    address?: string;
  },
) => Promise<string | { signedTxXdr: string; signerAddress?: string }>;

/**
 * Creates an SDK-compatible SignTransaction function from a Stellar Wallets Kit
 * instance or any compatible browser wallet provider.
 *
 * @param wallet The wallet instance or raw signing function.
 * @param defaultSignerAddress Optional default public key of the signer.
 */
export function createWalletSigner(
  wallet: BrowserWalletSignerLike | RawSignerFunction,
  defaultSignerAddress?: string,
): SignTransaction {
  return async (xdr, opts) => {
    let rawResult: string | { signedTxXdr: string; signerAddress?: string };

    if (typeof wallet === "function") {
      rawResult = await wallet(xdr, opts);
    } else if (wallet && typeof wallet.signTransaction === "function") {
      rawResult = await wallet.signTransaction(xdr, opts);
    } else {
      throw new Error(
        "Invalid wallet signer: must provide signTransaction method or a function",
      );
    }

    if (typeof rawResult === "string") {
      return {
        signedTxXdr: rawResult,
        signerAddress: opts?.address ?? defaultSignerAddress,
      };
    }

    if (rawResult && typeof rawResult.signedTxXdr === "string") {
      return {
        signedTxXdr: rawResult.signedTxXdr,
        signerAddress:
          rawResult.signerAddress ?? opts?.address ?? defaultSignerAddress,
      };
    }

    throw new Error(
      "Wallet returned an unexpected signature format; expected string or { signedTxXdr: string }",
    );
  };
}
