// Bundle entry: src/server.ts -> dist/server.cjs for Node 22 production.
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
  noExternal: ["@sadiyakargo/shared", "@sadiyakargo/pdf-templates"],
  external: ["bullmq"],
  loader: { ".tsx": "tsx" },
  // Copy the Unicode TTF used by PDF templates into the prod bundle's
  // dist/fonts/ dir — the runtime resolver (packages/pdf-templates/src/lib/
  // fonts.ts) probes both dev and prod paths and reads whichever exists.
  onSuccess:
    "mkdir -p dist/fonts && cp ../../packages/pdf-templates/src/fonts/NotoSans-VariableFont.ttf dist/fonts/",
});
