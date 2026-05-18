import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Register Noto Sans as the default font for every PDF. The built-in
 * Helvetica only supports Latin-1, so Cyrillic (RU/UZ) and several Turkish
 * diacritics rendered as missing-glyph fallbacks before this — see the
 * "@0=A?>@B=0O =0:;04=0O" gibberish report.
 *
 * We ship a single variable-weight TTF so one file covers
 * regular + bold across every locale we render.
 *
 * Path resolution has to survive two runtimes:
 *   - dev:  `tsx --watch` runs source directly → file lives next to src/lib/
 *   - prod: tsup bundles into apps/api/dist → tsup `onSuccess` copies the
 *           TTF into apps/api/dist/fonts/
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  join(__dirname, "..", "fonts", "NotoSans-VariableFont.ttf"),
  join(__dirname, "fonts", "NotoSans-VariableFont.ttf"),
];

let registered = false;

export function registerFonts(): void {
  if (registered) return;
  const fontPath = CANDIDATES.find((p) => existsSync(p));
  if (!fontPath) {
    // eslint-disable-next-line no-console
    console.warn(
      `[pdf-templates] NotoSans TTF NOT FOUND. Tried:\n  ${CANDIDATES.join("\n  ")}\n  → PDFs will render Cyrillic as fallback boxes.`
    );
    registered = true;
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[pdf-templates] NotoSans registered from: ${fontPath}`);
  // @react-pdf/font v4 requires `src` to be a string (data-URL, file-URL or
  // absolute filesystem path). Passing a Buffer crashes with
  // `dataUrl.substring is not a function` inside isDataUrl(). The library
  // reads the file itself from this path.
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: fontPath, fontWeight: 400 },
      { src: fontPath, fontWeight: 700 },
    ],
  });
  // Disable hyphenation — @react-pdf's default word-wrap inserts soft hyphens
  // that look wrong on Turkish/Russian receipt text. Plain wrap is fine here.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
