/**
 * Convert <text> in SVG to <path> outlines using the vendored Plus Jakarta Sans files.
 * Published svg/ lockups must not depend on the typeface being installed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(ROOT, "fonts");
const PATH_DIGITS = 2;

/** @typedef {400 | 500 | 700} FontWeight */
/** @typedef {"start" | "middle" | "end"} TextAnchor */

const TEXT_RE = /<text\b([^>]*)>([^<]*)<\/text>/gi;

/** @type {Map<FontWeight, opentype.Font>} */
const fontCache = new Map();

/**
 * @param {FontWeight} weight
 */
function fontPathForWeight(weight) {
  switch (weight) {
    case 400:
      return join(FONT_DIR, "PlusJakartaSans-Regular.ttf");
    case 500:
      return join(FONT_DIR, "PlusJakartaSans-Medium.ttf");
    case 700:
      return join(FONT_DIR, "PlusJakartaSans-Bold.ttf");
    default: {
      const _never = /** @type {never} */ (weight);
      throw new Error(`unsupported font-weight: ${_never}`);
    }
  }
}

/**
 * @param {string | undefined} raw
 * @returns {FontWeight}
 */
function parseWeight(raw) {
  const n = Number(raw);
  if (n === 400 || n === 500 || n === 700) return n;
  throw new Error(`unsupported font-weight: ${raw}`);
}

/**
 * @param {string | undefined} raw
 * @returns {TextAnchor}
 */
function parseAnchor(raw) {
  const anchor = raw ?? "start";
  switch (anchor) {
    case "start":
    case "middle":
    case "end":
      return anchor;
    default: {
      const _never = /** @type {never} */ (anchor);
      throw new Error(`unsupported text-anchor: ${_never}`);
    }
  }
}

/**
 * @param {FontWeight} weight
 */
function loadFont(weight) {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const buf = readFileSync(fontPathForWeight(weight));
  const font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  fontCache.set(weight, font);
  return font;
}

/**
 * @param {string} attrStr
 * @returns {Record<string, string>}
 */
function parseAttrs(attrStr) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of attrStr.matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = m[3] ?? m[4];
  }
  return out;
}

/**
 * @param {TextAnchor} anchor
 * @param {number} x0
 * @param {number} width
 */
function startX(anchor, x0, width) {
  switch (anchor) {
    case "start":
      return x0;
    case "middle":
      return x0 - width / 2;
    case "end":
      return x0 - width;
    default: {
      const _never = /** @type {never} */ (anchor);
      throw new Error(`unsupported text-anchor: ${_never}`);
    }
  }
}

/**
 * @param {string} text
 * @param {Record<string, string>} attrs
 */
function textToPathData(text, attrs) {
  const family = attrs["font-family"] ?? "";
  if (!/plus jakarta sans/i.test(family)) {
    throw new Error(`cannot outline text with font-family="${family}"`);
  }
  const fontSize = Number(attrs["font-size"]);
  const letterSpacing = Number(attrs["letter-spacing"] ?? 0);
  const x0 = Number(attrs.x);
  const y = Number(attrs.y);
  if (![fontSize, letterSpacing, x0, y].every(Number.isFinite)) {
    throw new Error("text is missing numeric x/y/font-size");
  }
  const font = loadFont(parseWeight(attrs["font-weight"]));
  const anchor = parseAnchor(attrs["text-anchor"]);
  const fontScale = (1 / font.unitsPerEm) * fontSize;
  const glyphs = font.stringToGlyphs(text);

  /** @type {Array<{ adv: number, kern: number, extra: number }>} */
  const advances = [];
  let width = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const adv = (glyph.advanceWidth ?? 0) * fontScale;
    const kern =
      i < glyphs.length - 1
        ? font.getKerningValue(glyph, glyphs[i + 1]) * fontScale
        : 0;
    const extra = i < glyphs.length - 1 ? letterSpacing : 0;
    advances.push({ adv, kern, extra });
    width += adv + kern + extra;
  }

  let x = startX(anchor, x0, width);
  const full = new opentype.Path();
  for (let i = 0; i < glyphs.length; i++) {
    full.extend(glyphs[i].getPath(x, y, fontSize));
    const step = advances[i];
    x += step.adv + step.kern + step.extra;
  }
  return full.toPathData(PATH_DIGITS);
}

/**
 * Replace every <text> with a <path> that uses the same size, weight,
 * letter-spacing and position. SVGs without text are returned unchanged.
 *
 * @param {string} svg
 * @returns {string}
 */
export function outlineSvgText(svg) {
  if (!/<text\b/i.test(svg)) return svg;
  return svg.replace(TEXT_RE, (_, attrStr, content) => {
    const attrs = parseAttrs(attrStr);
    const d = textToPathData(content, attrs);
    const fill = attrs.fill ?? "#000000";
    return `<path d="${d}" fill="${fill}"/>`;
  });
}

/**
 * Published svg/ files must ship outlines, not live text.
 *
 * @param {string} svg
 * @param {string} path
 */
export function assertPublishedSvgOutlined(svg, path) {
  if (/<\/?(?:[\w.-]+:)?text[\s>/]/i.test(svg)) {
    throw new Error(
      `${path}: published SVG must convert <text> to path outlines`,
    );
  }
}
