export {
  Umbra,
  arbiter,
  verdict,
  type UmbraOptions,
  type HireParams,
  type SignTransaction,
} from "./umbra.js";

export type {
  UmbraOptions as ClientOptions,
  HireParams as ClientHireParams,
} from "./types.js";

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
  buildSignedVerdictPayload,
  signVerdictPayload,
  verifyVerdictSignature,
  ADJUDICATOR_DOMAIN,
} from "./adjudicator.js";

export {
  UmbraVault,
  type SellerAccountSummary,
  type LockRecord,
  type VaultOptions,
} from "./vault.js";

export {
  deployments,
  rpcUrls,
  type Deployment,
  type NetworkName,
} from "./deployments.js";

export {
  UmbraError,
  SignerRequiredError,
  StateTimeoutError,
  ContractCallError,
  EscrowNotFoundError,
  NotAuthorizedError,
  InvalidStateError,
  InvalidAmountError,
  InvalidWindowError,
  ArbiterRequiredError,
  DisputeWindowClosedError,
  ConfirmWindowOpenError,
  InvalidVerdictError,
  InvalidWindowOrderingError,
  BelowThresholdError,
  DuplicateSignerError,
  InvalidThresholdError,
  extractContractErrorCode,
  mapContractError,
} from "./errors.js";

export { withRetry, type RetryOptions } from "./retry.js";

export {
  decodeTransition,
  filterEscrowEvents,
  decodeAttestationRecord,
  type DecodedTransition,
  type DecodedAttestationRecord,
  type SorobanEventLike,
} from "./events.js";

export {
  createWalletSigner,
  type BrowserWalletSignerLike,
  type RawSignerFunction,
} from "./wallet.js";

export {
  estimateTransaction,
  type TransactionEstimation,
  type ResourceFootprint,
} from "./simulation.js";

export {
  ValidationError,
  isValidStellarAddress,
  assertValidStellarAddress,
  assertPositiveAmount,
  assertPositiveNumber,
  assertNonEmptyString,
} from "./validation.js";

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
