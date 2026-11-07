import { State } from "./generated/index.js";

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
