import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA3W2JO6TD3JCPTNUSNSMNROYM6NSSQID55H5BKO6GLQQKNZ5KKEIZZG",
  }
} as const

/**
 * Every reachable failure returns one of these codes. Codes are stable across
 * releases so the SDK and the app can branch on them; do not renumber.
 */
export const Errors = {
  1: {message:"EscrowNotFound"},
  2: {message:"NotAuthorized"},
  3: {message:"InvalidState"},
  4: {message:"InvalidAmount"},
  5: {message:"InvalidWindow"},
  /**
   * dispute() was called on an escrow whose arbiter is `None`, so no one
   * could ever resolve it.
   */
  6: {message:"ArbiterRequired"},
  /**
   * The requested arbiter variant is declared but not implemented in v0.1.
   */
  7: {message:"Unimplemented"},
  /**
   * dispute() after the dispute window closed.
   */
  8: {message:"DisputeWindowClosed"},
  /**
   * claim_timeout() before the confirm window elapsed.
   */
  9: {message:"ConfirmWindowOpen"},
  /**
   * Split verdict with buyer_bps outside 0..=10000.
   */
  10: {message:"InvalidVerdict"},
  11: {message:"Overflow"}
}

/**
 * Lifecycle state. Terminal states (Released, Refunded, ResolvedBuyer,
 * ResolvedSeller, ResolvedSplit) accept no further transitions. The normative
 * transition table lives in docs/protocol.md; code follows it.
 */
export enum State {
  Created = 0,
  Funded = 1,
  Delivered = 2,
  Disputed = 3,
  Released = 4,
  Refunded = 5,
  ResolvedBuyer = 6,
  ResolvedSeller = 7,
  ResolvedSplit = 8,
}


export interface Escrow {
  amount: i128;
  arbiter: ArbiterConfig;
  asset: string;
  buyer: string;
  confirm_window: u64;
  created_at: u64;
  deliver_by: u64;
  /**
 * Ledger time of mark_delivered; the confirm and dispute windows count
 * from here. Zero until delivery.
 */
delivered_at: u64;
  dispute_window: u64;
  id: u64;
  proof_hash: Buffer;
  reason_hash: Buffer;
  seller: string;
  state: State;
  terms_hash: Buffer;
}

export type DataKey = {tag: "Escrow", values: readonly [u64]} | {tag: "NextId", values: void};

/**
 * An arbiter's decision. Amounts split with `Split` round the remainder to the
 * seller; see docs/protocol.md.
 */
export type Verdict = {tag: "RefundBuyer", values: void} | {tag: "ReleaseSeller", values: void} | {tag: "Split", values: readonly [u32]};

/**
 * Who may resolve a dispute. `Panel` and `Signed` are declared so the storage
 * layout and the interface are stable when panel arbitration and the signed
 * adjudicator land; v0.1 implements only `None` and `Single` and returns
 * `Unimplemented` for the rest at resolve time.
 */
export type ArbiterConfig = {tag: "None", values: void} | {tag: "Single", values: readonly [string]} | {tag: "Panel", values: readonly [Array<string>, u32]} | {tag: "Signed", values: readonly [Buffer]};


export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T2. The buyer transfers `amount` of `asset` into the
   * contract. Only the buyer, only from `Created`.
   */
  fund: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T8. Either party cancels before delivery. Any funds return
   * to the buyer. `caller` is authenticated and must be a party; the PRD
   * signature omits it, but authenticating "either party" needs to know who.
   */
  cancel: ({escrow_id, caller}: {escrow_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a confirm transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T4. The buyer accepts delivery and releases funds to the
   * seller immediately.
   */
  confirm: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T6. The buyer disputes within the dispute window, recording
   * the reason by its hash. Rejected when the escrow has no arbiter, since
   * nothing could then resolve it.
   */
  dispute: ({escrow_id, reason_hash}: {escrow_id: u64, reason_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resolve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T7. The escrow's arbiter resolves a dispute. `signature` is
   * reserved for the `Signed` adjudicator variant and unused in v0.1.
   */
  resolve: ({escrow_id, verdict, signature}: {escrow_id: u64, verdict: Verdict, signature: Option<Buffer>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Escrow>>>

  /**
   * Construct and simulate a claim_timeout transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T5. After the confirm window the seller may claim payment
   * even without an explicit confirm. Time is the ledger's, never a caller's.
   */
  claim_timeout: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T1. Records an agreement in `Created`. The buyer authorises,
   * because the buyer is the party who will move funds in `fund`.
   */
  create_escrow: ({buyer, seller, asset, amount, deliver_by, confirm_window, dispute_window, arbiter, terms_hash}: {buyer: string, seller: string, asset: string, amount: i128, deliver_by: u64, confirm_window: u64, dispute_window: u64, arbiter: ArbiterConfig, terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a mark_delivered transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * protocol.md T3. The seller records an off-chain delivery proof by its
   * hash and starts the confirm and dispute windows.
   */
  mark_delivered: ({escrow_id, proof_hash}: {escrow_id: u64, proof_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAG9wcm90b2NvbC5tZCBUMi4gVGhlIGJ1eWVyIHRyYW5zZmVycyBgYW1vdW50YCBvZiBgYXNzZXRgIGludG8gdGhlCmNvbnRyYWN0LiBPbmx5IHRoZSBidXllciwgb25seSBmcm9tIGBDcmVhdGVkYC4AAAAABGZ1bmQAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAANRwcm90b2NvbC5tZCBUOC4gRWl0aGVyIHBhcnR5IGNhbmNlbHMgYmVmb3JlIGRlbGl2ZXJ5LiBBbnkgZnVuZHMgcmV0dXJuCnRvIHRoZSBidXllci4gYGNhbGxlcmAgaXMgYXV0aGVudGljYXRlZCBhbmQgbXVzdCBiZSBhIHBhcnR5OyB0aGUgUFJECnNpZ25hdHVyZSBvbWl0cyBpdCwgYnV0IGF1dGhlbnRpY2F0aW5nICJlaXRoZXIgcGFydHkiIG5lZWRzIHRvIGtub3cgd2hvLgAAAAZjYW5jZWwAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAFhwcm90b2NvbC5tZCBUNC4gVGhlIGJ1eWVyIGFjY2VwdHMgZGVsaXZlcnkgYW5kIHJlbGVhc2VzIGZ1bmRzIHRvIHRoZQpzZWxsZXIgaW1tZWRpYXRlbHkuAAAAB2NvbmZpcm0AAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAK1wcm90b2NvbC5tZCBUNi4gVGhlIGJ1eWVyIGRpc3B1dGVzIHdpdGhpbiB0aGUgZGlzcHV0ZSB3aW5kb3csIHJlY29yZGluZwp0aGUgcmVhc29uIGJ5IGl0cyBoYXNoLiBSZWplY3RlZCB3aGVuIHRoZSBlc2Nyb3cgaGFzIG5vIGFyYml0ZXIsIHNpbmNlCm5vdGhpbmcgY291bGQgdGhlbiByZXNvbHZlIGl0LgAAAAAAAAdkaXNwdXRlAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAAC3JlYXNvbl9oYXNoAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAIlwcm90b2NvbC5tZCBUNy4gVGhlIGVzY3JvdydzIGFyYml0ZXIgcmVzb2x2ZXMgYSBkaXNwdXRlLiBgc2lnbmF0dXJlYCBpcwpyZXNlcnZlZCBmb3IgdGhlIGBTaWduZWRgIGFkanVkaWNhdG9yIHZhcmlhbnQgYW5kIHVudXNlZCBpbiB2MC4xLgAAAAAAAAdyZXNvbHZlAAAAAAMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAAB3ZlcmRpY3QAAAAH0AAAAAdWZXJkaWN0AAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAD6AAAA+4AAABAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAEAAAPoAAAH0AAAAAZFc2Nyb3cAAA==",
        "AAAAAAAAAI9wcm90b2NvbC5tZCBUNS4gQWZ0ZXIgdGhlIGNvbmZpcm0gd2luZG93IHRoZSBzZWxsZXIgbWF5IGNsYWltIHBheW1lbnQKZXZlbiB3aXRob3V0IGFuIGV4cGxpY2l0IGNvbmZpcm0uIFRpbWUgaXMgdGhlIGxlZGdlcidzLCBuZXZlciBhIGNhbGxlcidzLgAAAAANY2xhaW1fdGltZW91dAAAAAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAIZwcm90b2NvbC5tZCBUMS4gUmVjb3JkcyBhbiBhZ3JlZW1lbnQgaW4gYENyZWF0ZWRgLiBUaGUgYnV5ZXIgYXV0aG9yaXNlcywKYmVjYXVzZSB0aGUgYnV5ZXIgaXMgdGhlIHBhcnR5IHdobyB3aWxsIG1vdmUgZnVuZHMgaW4gYGZ1bmRgLgAAAAAADWNyZWF0ZV9lc2Nyb3cAAAAAAAAJAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACmRlbGl2ZXJfYnkAAAAAAAYAAAAAAAAADmNvbmZpcm1fd2luZG93AAAAAAAGAAAAAAAAAA5kaXNwdXRlX3dpbmRvdwAAAAAABgAAAAAAAAAHYXJiaXRlcgAAAAfQAAAADUFyYml0ZXJDb25maWcAAAAAAAAAAAAACnRlcm1zX2hhc2gAAAAAA+4AAAAgAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAHZwcm90b2NvbC5tZCBUMy4gVGhlIHNlbGxlciByZWNvcmRzIGFuIG9mZi1jaGFpbiBkZWxpdmVyeSBwcm9vZiBieSBpdHMKaGFzaCBhbmQgc3RhcnRzIHRoZSBjb25maXJtIGFuZCBkaXNwdXRlIHdpbmRvd3MuAAAAAAAObWFya19kZWxpdmVyZWQAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAACnByb29mX2hhc2gAAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAABAAAAJBFdmVyeSByZWFjaGFibGUgZmFpbHVyZSByZXR1cm5zIG9uZSBvZiB0aGVzZSBjb2Rlcy4gQ29kZXMgYXJlIHN0YWJsZSBhY3Jvc3MKcmVsZWFzZXMgc28gdGhlIFNESyBhbmQgdGhlIGFwcCBjYW4gYnJhbmNoIG9uIHRoZW07IGRvIG5vdCByZW51bWJlci4AAAAAAAAABUVycm9yAAAAAAAACwAAAAAAAAAORXNjcm93Tm90Rm91bmQAAAAAAAEAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAACAAAAAAAAAAxJbnZhbGlkU3RhdGUAAAADAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABAAAAAAAAAANSW52YWxpZFdpbmRvdwAAAAAAAAUAAABbZGlzcHV0ZSgpIHdhcyBjYWxsZWQgb24gYW4gZXNjcm93IHdob3NlIGFyYml0ZXIgaXMgYE5vbmVgLCBzbyBubyBvbmUKY291bGQgZXZlciByZXNvbHZlIGl0LgAAAAAPQXJiaXRlclJlcXVpcmVkAAAAAAYAAABGVGhlIHJlcXVlc3RlZCBhcmJpdGVyIHZhcmlhbnQgaXMgZGVjbGFyZWQgYnV0IG5vdCBpbXBsZW1lbnRlZCBpbiB2MC4xLgAAAAAADVVuaW1wbGVtZW50ZWQAAAAAAAAHAAAAKmRpc3B1dGUoKSBhZnRlciB0aGUgZGlzcHV0ZSB3aW5kb3cgY2xvc2VkLgAAAAAAE0Rpc3B1dGVXaW5kb3dDbG9zZWQAAAAACAAAADJjbGFpbV90aW1lb3V0KCkgYmVmb3JlIHRoZSBjb25maXJtIHdpbmRvdyBlbGFwc2VkLgAAAAAAEUNvbmZpcm1XaW5kb3dPcGVuAAAAAAAACQAAAC9TcGxpdCB2ZXJkaWN0IHdpdGggYnV5ZXJfYnBzIG91dHNpZGUgMC4uPTEwMDAwLgAAAAAOSW52YWxpZFZlcmRpY3QAAAAAAAoAAAAAAAAACE92ZXJmbG93AAAACw==",
        "AAAAAwAAAM1MaWZlY3ljbGUgc3RhdGUuIFRlcm1pbmFsIHN0YXRlcyAoUmVsZWFzZWQsIFJlZnVuZGVkLCBSZXNvbHZlZEJ1eWVyLApSZXNvbHZlZFNlbGxlciwgUmVzb2x2ZWRTcGxpdCkgYWNjZXB0IG5vIGZ1cnRoZXIgdHJhbnNpdGlvbnMuIFRoZSBub3JtYXRpdmUKdHJhbnNpdGlvbiB0YWJsZSBsaXZlcyBpbiBkb2NzL3Byb3RvY29sLm1kOyBjb2RlIGZvbGxvd3MgaXQuAAAAAAAAAAAAAAVTdGF0ZQAAAAAAAAkAAAAAAAAAB0NyZWF0ZWQAAAAAAAAAAAAAAAAGRnVuZGVkAAAAAAABAAAAAAAAAAlEZWxpdmVyZWQAAAAAAAACAAAAAAAAAAhEaXNwdXRlZAAAAAMAAAAAAAAACFJlbGVhc2VkAAAABAAAAAAAAAAIUmVmdW5kZWQAAAAFAAAAAAAAAA1SZXNvbHZlZEJ1eWVyAAAAAAAABgAAAAAAAAAOUmVzb2x2ZWRTZWxsZXIAAAAAAAcAAAAAAAAADVJlc29sdmVkU3BsaXQAAAAAAAAI",
        "AAAAAQAAAAAAAAAAAAAABkVzY3JvdwAAAAAADwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAdhcmJpdGVyAAAAB9AAAAANQXJiaXRlckNvbmZpZwAAAAAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAADmNvbmZpcm1fd2luZG93AAAAAAAGAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAApkZWxpdmVyX2J5AAAAAAAGAAAAZExlZGdlciB0aW1lIG9mIG1hcmtfZGVsaXZlcmVkOyB0aGUgY29uZmlybSBhbmQgZGlzcHV0ZSB3aW5kb3dzIGNvdW50CmZyb20gaGVyZS4gWmVybyB1bnRpbCBkZWxpdmVyeS4AAAAMZGVsaXZlcmVkX2F0AAAABgAAAAAAAAAOZGlzcHV0ZV93aW5kb3cAAAAAAAYAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAApwcm9vZl9oYXNoAAAAAAPuAAAAIAAAAAAAAAALcmVhc29uX2hhc2gAAAAD7gAAACAAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAFc3RhdGUAAAAAAAfQAAAABVN0YXRlAAAAAAAAAAAAAAp0ZXJtc19oYXNoAAAAAAPuAAAAIA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAABkVzY3JvdwAAAAAAAQAAAAYAAAAAAAAAAAAAAAZOZXh0SWQAAA==",
        "AAAAAgAAAGpBbiBhcmJpdGVyJ3MgZGVjaXNpb24uIEFtb3VudHMgc3BsaXQgd2l0aCBgU3BsaXRgIHJvdW5kIHRoZSByZW1haW5kZXIgdG8gdGhlCnNlbGxlcjsgc2VlIGRvY3MvcHJvdG9jb2wubWQuAAAAAAAAAAAAB1ZlcmRpY3QAAAAAAwAAAAAAAAAAAAAAC1JlZnVuZEJ1eWVyAAAAAAAAAAAAAAAADVJlbGVhc2VTZWxsZXIAAAAAAAABAAAAR2J1eWVyX2JwcyBpbiAwLi49MTAwMDAgaXMgdGhlIGJ1eWVyJ3Mgc2hhcmU7IHRoZSBzZWxsZXIgdGFrZXMgdGhlIHJlc3QuAAAAAAVTcGxpdAAAAAAAAAEAAAAE",
        "AAAAAgAAAQpXaG8gbWF5IHJlc29sdmUgYSBkaXNwdXRlLiBgUGFuZWxgIGFuZCBgU2lnbmVkYCBhcmUgZGVjbGFyZWQgc28gdGhlIHN0b3JhZ2UKbGF5b3V0IGFuZCB0aGUgaW50ZXJmYWNlIGFyZSBzdGFibGUgd2hlbiBwYW5lbCBhcmJpdHJhdGlvbiBhbmQgdGhlIHNpZ25lZAphZGp1ZGljYXRvciBsYW5kOyB2MC4xIGltcGxlbWVudHMgb25seSBgTm9uZWAgYW5kIGBTaW5nbGVgIGFuZCByZXR1cm5zCmBVbmltcGxlbWVudGVkYCBmb3IgdGhlIHJlc3QgYXQgcmVzb2x2ZSB0aW1lLgAAAAAAAAAAAA1BcmJpdGVyQ29uZmlnAAAAAAAABAAAAAAAAABFVGltZW91dCBvbmx5LiBkaXNwdXRlKCkgaXMgcmVqZWN0ZWQgYmVjYXVzZSBub3RoaW5nIGNvdWxkIHJlc29sdmUgaXQuAAAAAAAABE5vbmUAAAABAAAAAAAAAAZTaW5nbGUAAAAAAAEAAAATAAAAAQAAAAAAAAAFUGFuZWwAAAAAAAACAAAD6gAAABMAAAAEAAAAAQAAAAAAAAAGU2lnbmVkAAAAAAABAAAD7gAAACA=",
        "AAAABQAAANtPbmUgZXZlbnQgcGVyIHRyYW5zaXRpb24sIHNvIGFuIGluZGV4ZXIgY2FuIHJlYnVpbGQgYW4gZXNjcm93J3MgaGlzdG9yeQp3aXRob3V0IHJlcGxheWluZyBjYWxscy4gYGtpbmRgIG5hbWVzIHRoZSB0cmFuc2l0aW9uIGFuZCBgZXNjcm93YCBpcyB0aGUgaWQ7CmJvdGggYXJlIHRvcGljcyBzbyBhIGNvbnN1bWVyIGNhbiBzdWJzY3JpYmUgdG8gb25lIGVzY3JvdyBvciBvbmUga2luZC4AAAAAAAAAAApUcmFuc2l0aW9uAAAAAAABAAAABXVtYnJhAAAAAAAAAwAAAAAAAAAEa2luZAAAABEAAAABAAAAAAAAAAZlc2Nyb3cAAAAAAAYAAAABAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAAFU3RhdGUAAAAAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<Result<void>>,
        cancel: this.txFromJSON<Result<void>>,
        confirm: this.txFromJSON<Result<void>>,
        dispute: this.txFromJSON<Result<void>>,
        resolve: this.txFromJSON<Result<void>>,
        get_escrow: this.txFromJSON<Option<Escrow>>,
        claim_timeout: this.txFromJSON<Result<void>>,
        create_escrow: this.txFromJSON<Result<u64>>,
        mark_delivered: this.txFromJSON<Result<void>>
  }
}