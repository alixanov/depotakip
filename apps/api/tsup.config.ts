// Bundle entry: src/server.ts -> dist/server.cjs for Node 22 production.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_SRC = resolve(
  __dirname,
  "../../packages/pdf-templates/src/fonts/NotoSans-VariableFont.ttf"
);
const FONT_DST = resolve(__dirname, "dist/fonts/NotoSans-VariableFont.ttf");

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
  // pdf-templates resolves the bundled TTF via `import.meta.url`, which is
  // `undefined` inside a CJS bundle — without this shim, the prod container
  // crashes at startup with `fileURLToPath(undefined)`. tsup's shim rewrites
  // `import.meta.url` to `new URL("file:" + __filename).href`.
  shims: true,
  // Copy the Unicode TTF used by PDF templates into the prod bundle's
  // dist/fonts/ dir — the runtime resolver (packages/pdf-templates/src/lib/
  // fonts.ts) probes both dev and prod paths and reads whichever exists.
  // Using node:fs over a shell `cp` so the copy works the same on Railway's
  // Nixpacks build, in CI, and on dev machines without GNU coreutils quirks.
  onSuccess: async () => {
    mkdirSync(dirname(FONT_DST), { recursive: true });
    copyFileSync(FONT_SRC, FONT_DST);

    console.log(`[tsup] copied font → ${FONT_DST}`);
  },
});
