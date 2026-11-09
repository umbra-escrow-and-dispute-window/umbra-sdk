import { State, Errors } from "./generated/index.js";

/** Base error class for all Umbra SDK errors. */
export class UmbraError extends Error {
  readonly code: string;

  constructor(message: string, code = "UMBRA_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a write transaction is invoked without required signer credentials. */
export class SignerRequiredError extends UmbraError {
  constructor(
    message = "hire requires a signer: set publicKey and signTransaction",
  ) {
    super(message, "SIGNER_REQUIRED");
  }
}

/** Thrown when an escrow does not reach the expected State before timeout. */
export class StateTimeoutError extends UmbraError {
  readonly escrowId: bigint;
  readonly targetState: State;
  readonly timeoutMs: number;

  constructor(escrowId: bigint, targetState: State, timeoutMs: number) {
    super(
      `escrow ${escrowId} did not reach ${State[targetState]} within ${timeoutMs}ms`,
      "STATE_TIMEOUT",
    );
    this.escrowId = escrowId;
    this.targetState = targetState;
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown when a contract invocation or simulation fails. */
export class ContractCallError extends UmbraError {
  readonly contractErrorCode?: number;

  constructor(
    message: string,
    contractErrorCode?: number,
    code = "CONTRACT_CALL_FAILED",
  ) {
    super(message, code);
    this.contractErrorCode = contractErrorCode;
  }
}

/** Thrown when an escrow ID does not exist on-chain (Contract Error #1). */
export class EscrowNotFoundError extends ContractCallError {
  constructor(message = Errors[1].message) {
    super(message, 1, "ESCROW_NOT_FOUND");
  }
}

/** Thrown when caller is not authorized for the escrow action (Contract Error #2). */
export class NotAuthorizedError extends ContractCallError {
  constructor(message = Errors[2].message) {
    super(message, 2, "NOT_AUTHORIZED");
  }
}

/** Thrown when escrow transition is invalid for current state (Contract Error #3). */
export class InvalidStateError extends ContractCallError {
  constructor(message = Errors[3].message) {
    super(message, 3, "INVALID_STATE");
  }
}

/** Thrown when escrow amount is zero or exceeds balance (Contract Error #4). */
export class InvalidAmountError extends ContractCallError {
  constructor(message = Errors[4].message) {
    super(message, 4, "INVALID_AMOUNT");
  }
}

/** Thrown when dispute or confirmation window duration is invalid (Contract Error #5). */
export class InvalidWindowError extends ContractCallError {
  constructor(message = Errors[5].message) {
    super(message, 5, "INVALID_WINDOW");
  }
}

/** Thrown when an action requires an arbiter but none is configured (Contract Error #6). */
export class ArbiterRequiredError extends ContractCallError {
  constructor(message = Errors[6].message) {
    super(message, 6, "ARBITER_REQUIRED");
  }
}

/** Thrown when action is attempted after dispute window has elapsed (Contract Error #8). */
export class DisputeWindowClosedError extends ContractCallError {
  constructor(message = Errors[8].message) {
    super(message, 8, "DISPUTE_WINDOW_CLOSED");
  }
}

/** Thrown when action cannot proceed because confirm window is still open (Contract Error #9). */
export class ConfirmWindowOpenError extends ContractCallError {
  constructor(message = Errors[9].message) {
    super(message, 9, "CONFIRM_WINDOW_OPEN");
  }
}

/** Thrown when dispute resolution verdict is not recognized (Contract Error #10). */
export class InvalidVerdictError extends ContractCallError {
  constructor(message = Errors[10].message) {
    super(message, 10, "INVALID_VERDICT");
  }
}

/** Thrown when confirm window is shorter than dispute window (Contract Error #12). */
export class InvalidWindowOrderingError extends ContractCallError {
  constructor(message = "confirm_window must be >= dispute_window") {
    super(message, 12, "INVALID_WINDOW_ORDERING");
  }
}

/** Thrown when panel arbitration has fewer than threshold valid signatures (Contract Error #13). */
export class BelowThresholdError extends ContractCallError {
  constructor(message = "below arbitration threshold requirement") {
    super(message, 13, "BELOW_THRESHOLD");
  }
}

/** Thrown when duplicate panel signatures are submitted (Contract Error #14). */
export class DuplicateSignerError extends ContractCallError {
  constructor(message = "duplicate arbiter signer detected") {
    super(message, 14, "DUPLICATE_SIGNER");
  }
}

/** Thrown when arbiter panel threshold is zero or exceeds member count (Contract Error #15). */
export class InvalidThresholdError extends ContractCallError {
  constructor(message = "invalid panel arbitration threshold") {
    super(message, 15, "INVALID_THRESHOLD");
  }
}

/**
 * Extracts a numeric Soroban contract error code from an error or error message string.
 */
export function extractContractErrorCode(error: unknown): number | undefined {
  if (typeof error === "number") return error;
  if (!error) return undefined;
  if (
    typeof error === "object" &&
    "contractErrorCode" in error &&
    typeof (error as { contractErrorCode?: unknown }).contractErrorCode ===
      "number"
  ) {
    return (error as { contractErrorCode: number }).contractErrorCode;
  }
  const msg = error instanceof Error ? error.message : String(error);
  const match =
    msg.match(/Contract,\s*#?(\d+)/i) ??
    msg.match(/ContractError\((\d+)\)/i) ??
    msg.match(/error\s*code\s*[:#]?\s*(\d+)/i);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Maps any error or Soroban contract error code into a specific typed ContractCallError subclass.
 */
export function mapContractError(error: unknown): ContractCallError {
  const code = extractContractErrorCode(error);
  const baseMessage = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 1:
      return new EscrowNotFoundError(baseMessage);
    case 2:
      return new NotAuthorizedError(baseMessage);
    case 3:
      return new InvalidStateError(baseMessage);
    case 4:
      return new InvalidAmountError(baseMessage);
    case 5:
      return new InvalidWindowError(baseMessage);
    case 6:
      return new ArbiterRequiredError(baseMessage);
    case 8:
      return new DisputeWindowClosedError(baseMessage);
    case 9:
      return new ConfirmWindowOpenError(baseMessage);
    case 10:
      return new InvalidVerdictError(baseMessage);
    case 12:
      return new InvalidWindowOrderingError(baseMessage);
    case 13:
      return new BelowThresholdError(baseMessage);
    case 14:
      return new DuplicateSignerError(baseMessage);
    case 15:
      return new InvalidThresholdError(baseMessage);
    default:
      return error instanceof ContractCallError
        ? error
        : new ContractCallError(baseMessage, code);
  }
}
