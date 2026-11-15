import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderSvgToPng } from "./render-svg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** Trimmed visual lockup width on the 1200×630 card. */
export const OG_LOCKUP_WIDTH = 800;
export const OG_THEMES = /** @type {const} */ (["dark", "light"]);

/** @typedef {"dark" | "light"} OgTheme */

const OG_SPECS = {
  dark: {
    svg: "src/logo/wordmark/sources/lockup-horizontal/on-dark-transparent.svg",
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  },
  light: {
    svg: "src/logo/wordmark/sources/lockup-horizontal/on-light-transparent.svg",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
};

/**
 * @param {OgTheme} theme
 */
export function ogSpec(theme) {
  switch (theme) {
    case "dark":
      return OG_SPECS.dark;
    case "light":
      return OG_SPECS.light;
    default: {
      const _exhaustive = /** @type {never} */ (theme);
      throw new Error(`unknown OG theme: ${_exhaustive}`);
    }
  }
}

export function ogPath(theme) {
  return join(ROOT, "src/og-image", theme, "og-default.png");
}

/**
 * Horizontal lockup centred on a 1200×630 Singleton ground.
 * @param {OgTheme} theme
 * @returns {Promise<Buffer>}
 */
export async function renderOgDefault(theme) {
  const spec = ogSpec(theme);
  const svg = await readFile(join(ROOT, spec.svg), "utf8");
  // Render large, trim viewBox padding, then scale the visual lockup.
  const raw = renderSvgToPng(svg, { width: OG_LOCKUP_WIDTH * 2 });
  const lockup = await sharp(raw)
    .trim({ threshold: 8 })
    .resize({ width: OG_LOCKUP_WIDTH })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 4,
      background: spec.background,
    },
  })
    .composite([{ input: lockup, gravity: "centre" }])
    .png()
    .toBuffer();
}

export async function writeOgDefaults() {
  /** @type {string[]} */
  const written = [];
  for (const theme of OG_THEMES) {
    const out = ogPath(theme);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, await renderOgDefault(theme));
    written.push(out);
  }
  return written;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  writeOgDefaults()
    .then((paths) => {
      for (const path of paths) console.log(path);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
