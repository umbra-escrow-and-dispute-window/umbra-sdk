import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // The Stellar SDK is a peer runtime dependency, not something to inline.
  external: ["@stellar/stellar-sdk"],
});
