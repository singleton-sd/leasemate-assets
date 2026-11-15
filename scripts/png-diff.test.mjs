import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NAMED_RASTERS } from "./build.mjs";
import { assertPngWithinTolerance, diffPngBuffers } from "./png-diff.mjs";
import { renderSvgToPng } from "./render-svg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PNG = join(ROOT, "png");

/** AA/encoder drift vs approved comps (16/32px ~9%); well below a swapped PNG. */
const MAX_PERCENT = 15;
const MAX_MEAN_ABS = 20;

/**
 * @param {number} width
 * @param {number} height
 * @param {{ r: number, g: number, b: number, alpha?: number }} color
 */
function solidPng(width, height, color) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: color.r, g: color.g, b: color.b, alpha: color.alpha ?? 1 },
    },
  })
    .png()
    .toBuffer();
}

test("diffPngBuffers reports identical images as zero", async () => {
  const a = await solidPng(8, 8, { r: 10, g: 20, b: 30 });
  const b = await solidPng(8, 8, { r: 10, g: 20, b: 30 });
  const diff = await diffPngBuffers(a, b);
  assert.equal(diff.differing, 0);
  assert.equal(diff.percent, 0);
  assert.equal(diff.meanAbs, 0);
});

test("diffPngBuffers rejects a same-size unrelated image", async () => {
  const black = await solidPng(8, 8, { r: 0, g: 0, b: 0 });
  const white = await solidPng(8, 8, { r: 255, g: 255, b: 255 });
  const diff = await diffPngBuffers(black, white);
  assert.equal(diff.percent, 100);
  assert.equal(diff.meanAbs, (255 * 3) / 4);
  assert.throws(
    () => assertPngWithinTolerance(diff, { maxPercent: MAX_PERCENT, maxMeanAbs: MAX_MEAN_ABS }),
    /exceeds/,
  );
});

test("diffPngBuffers rejects a same-RGB image whose alpha differs", async () => {
  const opaque = await solidPng(8, 8, { r: 0, g: 0, b: 0, alpha: 1 });
  const clear = await solidPng(8, 8, { r: 0, g: 0, b: 0, alpha: 0 });
  const diff = await diffPngBuffers(opaque, clear);
  assert.equal(diff.percent, 100);
  assert.equal(diff.meanAbs, 255 / 4);
  assert.throws(
    () => assertPngWithinTolerance(diff, { maxPercent: MAX_PERCENT, maxMeanAbs: MAX_MEAN_ABS }),
    /exceeds/,
  );
});

test("diffPngBuffers rejects a size mismatch", async () => {
  const a = await solidPng(8, 8, { r: 0, g: 0, b: 0 });
  const b = await solidPng(4, 4, { r: 0, g: 0, b: 0 });
  await assert.rejects(() => diffPngBuffers(a, b), /size mismatch/);
});

test("selectApprovedOrGenerated would keep a same-size wrong PNG; pixel diff catches it", async () => {
  const svg = await readFile(join(ROOT, "src/logo/sources/dark.svg"), "utf8");
  const generated = renderSvgToPng(svg, { width: 512, height: 512 });
  const impostor = await solidPng(512, 512, { r: 0, g: 0, b: 0 });
  const diff = await diffPngBuffers(impostor, generated);
  assert.ok(diff.percent > MAX_PERCENT || diff.meanAbs > MAX_MEAN_ABS);
  assert.throws(
    () =>
      assertPngWithinTolerance(
        { ...diff, file: "leasemate-icon-dark-512.png" },
        { maxPercent: MAX_PERCENT, maxMeanAbs: MAX_MEAN_ABS },
      ),
    /leasemate-icon-dark-512\.png/,
  );
});

test("committed named PNGs stay within tolerance of their SVG render", async () => {
  for (const spec of NAMED_RASTERS) {
    const svg = await readFile(join(ROOT, spec.svg), "utf8");
    const generated = renderSvgToPng(svg, {
      width: spec.width,
      height: spec.height,
    });
    const approved = await readFile(join(PNG, spec.file));
    const diff = await diffPngBuffers(approved, generated);
    assertPngWithinTolerance(
      { ...diff, file: spec.file },
      { maxPercent: MAX_PERCENT, maxMeanAbs: MAX_MEAN_ABS },
    );
  }
});
