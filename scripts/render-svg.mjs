#!/usr/bin/env node
/**
 * Rasterize SVG with the vendored Open Sauce Sans files only.
 * System fonts are disabled so lockup text can never fall back.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FONT_DIR = join(ROOT, "fonts");
export const FONT_FAMILY = "Open Sauce Sans";

export const FONT_FILES = [
  join(FONT_DIR, "OpenSauceSans-Medium.ttf"),
  join(FONT_DIR, "OpenSauceSans-SemiBold.ttf"),
];

/** Pinned SHA-256 of the vendored OFL files (name table must also say Open Sauce Sans). */
export const FONT_SHA256 = {
  "OpenSauceSans-Medium.ttf":
    "afb340900182f0c611fe426d42e504a4ebdff08d5b7e02f60be2c77f64067c9f",
  "OpenSauceSans-SemiBold.ttf":
    "9fbced4ee2764ed6272f636d8370f759260e0978e838b96c9bb0865b8f94e4f8",
};

export function fontFiles() {
  return FONT_FILES;
}

function utf16be(buf) {
  if (buf.length % 2) {
    throw new Error("odd UTF-16BE length");
  }
  const swapped = Buffer.from(buf);
  swapped.swap16();
  return swapped.toString("utf16le");
}

/** @param {Buffer} buf */
export function ttfFamilyNames(buf) {
  if (buf.length < 12) {
    throw new Error("font too small");
  }
  const sfnt = buf.subarray(0, 4);
  const okTag =
    sfnt.equals(Buffer.from([0, 1, 0, 0])) ||
    sfnt.toString("ascii") === "true" ||
    sfnt.toString("ascii") === "OTTO";
  if (!okTag) {
    throw new Error("not a TrueType/OpenType font");
  }
  const numTables = buf.readUInt16BE(4);
  let nameOffset;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > buf.length) break;
    const tag = buf.toString("ascii", rec, rec + 4);
    if (tag === "name") {
      nameOffset = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (nameOffset == null || nameOffset + 6 > buf.length) {
    throw new Error("font missing name table");
  }
  const count = buf.readUInt16BE(nameOffset + 2);
  const stringOffset = buf.readUInt16BE(nameOffset + 4);
  const names = [];
  for (let i = 0; i < count; i++) {
    const e = nameOffset + 6 + i * 12;
    if (e + 12 > buf.length) break;
    const platformID = buf.readUInt16BE(e);
    const nameID = buf.readUInt16BE(e + 6);
    const length = buf.readUInt16BE(e + 8);
    const offset = buf.readUInt16BE(e + 10);
    if (nameID !== 1 && nameID !== 4 && nameID !== 16) continue;
    const start = nameOffset + stringOffset + offset;
    if (start < 0 || start + length > buf.length) continue;
    const slice = buf.subarray(start, start + length);
    const text =
      platformID === 0 || platformID === 3
        ? utf16be(slice)
        : slice.toString("latin1");
    if (text) names.push(text);
  }
  if (!names.length) {
    throw new Error("font name table has no family strings");
  }
  return names;
}

/**
 * @param {Buffer} buf
 * @param {{ sha256: string, label: string }} spec
 */
export function assertFontBuffer(buf, spec) {
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== spec.sha256) {
    throw new Error(
      `${spec.label}: checksum mismatch (got ${hash}, expected ${spec.sha256})`,
    );
  }
  const names = ttfFamilyNames(buf);
  if (!names.some((n) => /open sauce sans/i.test(n))) {
    throw new Error(
      `${spec.label}: family is not Open Sauce Sans (got ${names.join(", ")})`,
    );
  }
}

export function assertVendoredFonts() {
  for (const file of FONT_FILES) {
    const name = basename(file);
    const sha256 = FONT_SHA256[name];
    if (!sha256) throw new Error(`no pinned checksum for ${name}`);
    const buf = readFileSync(file);
    assertFontBuffer(buf, { sha256, label: name });
  }
}

/**
 * @param {Buffer|string} svg
 * @param {{ width?: number, height?: number }} [fit]
 * @returns {Buffer}
 */
export function renderSvgToPng(svg, fit = {}) {
  assertVendoredFonts();
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
