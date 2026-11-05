export {
  Umbra,
  arbiter,
  verdict,
  type UmbraOptions,
  type HireParams,
  type SignTransaction,
} from "./umbra.js";

export {
  canonicalize,
  hashTerms,
  hashDeliveryProof,
  hashDisputeReason,
  verifyTerms,
  verifyDeliveryProof,
  verifyDisputeReason,
  DOMAIN,
  type JsonValue,
} from "./hashing.js";

export {
  deployments,
  rpcUrls,
  type Deployment,
  type NetworkName,
} from "./deployments.js";

// Re-export the generated contract types so consumers have one import surface.
export {
  Client as EscrowClient,
  networks,
  Errors,
  State,
  type Escrow,
  type ArbiterConfig,
  type Verdict,
} from "./generated/index.js";
