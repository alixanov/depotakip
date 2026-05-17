import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["cjs"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
  bundle: true,
  noExternal: ["@depotakip/shared"],
  external: ["bullmq"],
});
