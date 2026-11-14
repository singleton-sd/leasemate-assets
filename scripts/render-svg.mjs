#!/usr/bin/env node
/**
 * Rasterize SVG with the vendored Open Sauce Sans files only.
 * System fonts are disabled so lockup text can never fall back.
 */
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FONT_DIR = join(ROOT, "fonts");
export const FONT_FAMILY = "Open Sauce Sans";

const FONT_FILES = [
  join(FONT_DIR, "OpenSauceSans-Medium.ttf"),
  join(FONT_DIR, "OpenSauceSans-SemiBold.ttf"),
];

export function fontFiles() {
  return FONT_FILES;
}

function assertOpenSauceSansLoaded(resvg) {
  const names = [];
  try {
    names.push(...resvg.fonts());
  } catch {
    // older bindings may not expose fonts(); inspect the directory instead
  }
  const dir = readdirSync(FONT_DIR).filter((n) => n.endsWith(".ttf"));
  if (dir.length < 2) {
    throw new Error(
      `Open Sauce Sans files missing in ${FONT_DIR} (found ${dir.join(", ") || "none"})`,
    );
  }
  if (names.length && !names.some((n) => /open sauce sans/i.test(n))) {
    throw new Error(
      `renderer did not load Open Sauce Sans (loaded: ${names.join(", ") || "none"})`,
    );
  }
}

/**
 * @param {Buffer|string} svg
 * @param {{ width?: number, height?: number }} [fit]
 * @returns {Buffer}
 */
export function renderSvgToPng(svg, fit = {}) {
  const svgStr = typeof svg === "string" ? svg : svg.toString("utf8");
  if (/font-family/i.test(svgStr) && !/Open Sauce Sans/i.test(svgStr)) {
    throw new Error("SVG text must use font-family=\"Open Sauce Sans\"");
  }

  /** @type {import('@resvg/resvg-js').ResvgRenderOptions} */
  const opts = {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  };

  if (fit.width && fit.height) {
    opts.fitTo = { mode: "width", value: fit.width };
  } else if (fit.width) {
    opts.fitTo = { mode: "width", value: fit.width };
  } else if (fit.height) {
    opts.fitTo = { mode: "height", value: fit.height };
  }

  const resvg = new Resvg(svgStr, opts);
  assertOpenSauceSansLoaded(resvg);
  const img = resvg.render();
  if (fit.width && img.width === 0) {
    throw new Error("resvg produced an empty image");
  }
  if (fit.width && img.width !== fit.width) {
    throw new Error(
      `resvg width ${img.width} !== requested ${fit.width}`,
    );
  }
  if (fit.height && img.height !== fit.height) {
    throw new Error(
      `resvg height ${img.height} !== requested ${fit.height}`,
    );
  }
  return Buffer.from(img.asPng());
}

export async function renderSvgFileToPng(path, fit) {
  const svg = await readFile(path);
  return renderSvgToPng(svg, fit);
}
