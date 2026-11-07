import { StrKey } from "@stellar/stellar-sdk";
import { UmbraError } from "./errors.js";

/** Thrown when client parameter validation fails before sending on-chain transaction. */
export class ValidationError extends UmbraError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR");
    this.field = field;
  }
}

/** Returns true if string is a valid Stellar account, contract, or multiplexed address. */
export function isValidStellarAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  return (
    StrKey.isValidEd25519PublicKey(address) ||
    StrKey.isValidContract(address) ||
    StrKey.isValidMed25519PublicKey(address)
  );
}

/** Asserts that a value is a valid Stellar address string. */
export function assertValidStellarAddress(
  address: unknown,
  fieldName = "address",
): asserts address is string {
  if (!isValidStellarAddress(address)) {
    throw new ValidationError(
      `Invalid Stellar address for '${fieldName}': expected valid StrKey (G... or C...)`,
      fieldName,
    );
  }
}

/** Asserts that an amount is a positive bigint (> 0n). */
export function assertPositiveAmount(
  amount: unknown,
  fieldName = "amount",
): asserts amount is bigint {
  if (typeof amount !== "bigint") {
    throw new ValidationError(`'${fieldName}' must be a bigint`, fieldName);
  }
  if (amount <= 0n) {
    throw new ValidationError(
      `'${fieldName}' must be greater than zero`,
      fieldName,
    );
  }
}

/** Asserts that a number is a positive integer (> 0). */
export function assertPositiveNumber(
  num: unknown,
  fieldName: string,
): asserts num is number {
  if (typeof num !== "number" || !Number.isFinite(num)) {
    throw new ValidationError(
      `'${fieldName}' must be a finite number`,
      fieldName,
    );
  }
  if (num <= 0) {
    throw new ValidationError(
      `'${fieldName}' must be greater than zero`,
      fieldName,
    );
  }
}

/** Asserts that a value is a non-empty string. */
export function assertNonEmptyString(
  val: unknown,
  fieldName: string,
): asserts val is string {
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new ValidationError(
      `'${fieldName}' must be a non-empty string`,
      fieldName,
    );
  }
}
