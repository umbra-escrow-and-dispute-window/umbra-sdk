# Browser Wallet Integration & Transaction Simulation

The `@umbra-escrow-and-dispute-window/umbra-sdk` provides native helpers for integrating browser extension wallets (such as Freighter, xBull, and Stellar Wallets Kit) and inspecting transaction resource footprints prior to on-chain submission.

---

## 1. Browser Wallet Signer Adapter

The Stellar Wallets Kit and browser extension wallets typically expose an asynchronous signing method `signTransaction(xdr: string, opts?: { networkPassphrase?: string })`. The Umbra SDK client accepts a standard `SignTransaction` callback `(tx: Transaction | FeeBumpTransaction) => Promise<Transaction | FeeBumpTransaction>`.

The `createWalletSigner` adapter bridges these interfaces seamlessly:

```typescript
import { Umbra, createWalletSigner } from "@umbra-escrow-and-dispute-window/umbra-sdk";
import { StellarWalletsKit, WalletNetwork } from "@creit.tech/stellar-wallets-kit";

// 1. Initialize your favorite browser wallet kit
const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: "freighter",
});

const { address } = await kit.getAddress();

// 2. Wrap the kit signing method into an Umbra-compatible signer
const signTransaction = createWalletSigner(
  (xdr, opts) => kit.signTransaction(xdr, opts),
  "Test SDF Network ; September 2015"
);

// 3. Initialize Umbra client configured for the connected user
const client = new Umbra({
  network: "testnet",
  publicKey: address,
  signTransaction,
});

// Write calls will now prompt the user's browser extension for signatures!
const tx = await client.hire({
  seller: "GD...",
  amount: 100_000_000n,
  token: "CD...",
  engagementId: "ENG-2026-001",
  terms: { milestone: "Alpha Delivery", payout: 100 },
  disputeWindowLedgers: 17280,
});
```

### Direct Freighter Usage

```typescript
import { Umbra, createWalletSigner } from "@umbra-escrow-and-dispute-window/umbra-sdk";
import freighter from "@stellar/freighter-api";

const signTransaction = createWalletSigner(
  async (xdr, opts) => {
    const signed = await freighter.signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase,
    });
    return signed.signedTxXdr;
  },
  "Test SDF Network ; September 2015"
);

const client = new Umbra({
  network: "testnet",
  publicKey: await freighter.getPublicKey(),
  signTransaction,
});
```

---

## 2. Transaction Simulation and Resource Footprint Estimation

Before broadcasting transactions on Soroban, applications often need to display estimated network fees and resource footprints to users. The SDK provides `estimateTransaction`:

```typescript
import { estimateTransaction } from "@umbra-escrow-and-dispute-window/umbra-sdk";

// Obtain an AssembledTransaction from any Umbra or EscrowClient method call
const assembled = await client.contracts.escrow.fund({
  escrow_id: 42n,
  caller: client.options.publicKey,
});

// Run non-mutating simulation and compute fee analysis
const estimation = await estimateTransaction(assembled);

console.log(`Base min fee: ${estimation.minFee} stroops`);
console.log(`Recommended submission fee: ${estimation.recommendedFee} stroops`);
console.log(`CPU instructions: ${estimation.footprint.cpuInstructions}`);
console.log(`RAM memory bytes: ${estimation.footprint.ramBytes}`);
console.log(`Read bytes: ${estimation.footprint.readBytes}`);
console.log(`Write bytes: ${estimation.footprint.writeBytes}`);
```

### Estimation Properties

| Field | Type | Description |
|---|---|---|
| `minFee` | `string` | Minimum network fee calculated by Soroban RPC simulation. |
| `recommendedFee` | `string` | Recommended fee incorporating a safety buffer (default: 120% of min fee). |
| `footprint.cpuInstructions` | `number` | Simulated Soroban virtual machine CPU instruction count. |
| `footprint.ramBytes` | `number` | Simulated memory consumption. |
| `footprint.readBytes` | `number` | Total ledger state bytes read during invocation. |
| `footprint.writeBytes` | `number` | Total ledger state bytes written during invocation. |
| `rawSimulation` | `SimulateTransactionResponse` | Full raw simulation payload from Soroban RPC for advanced inspection. |
