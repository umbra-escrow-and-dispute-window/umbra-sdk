import deploymentsJson from "../deployments/testnet.json" with { type: "json" };

/** The protocol repository's deployment truth, vendored at build time. Consumers
 * read contract ids from here rather than hardcoding them (docs/multi-repo.md). */
export interface Deployment {
  network: string;
  networkPassphrase: string;
  deployedAt: string;
  commit: string;
  wasmSha256?: string;
  contracts: Record<string, string>;
}

export const deployments: Deployment = deploymentsJson as Deployment;

export type NetworkName = "testnet";

/** Default RPC endpoint per network. Override in the Umbra constructor. */
export const rpcUrls: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
};
