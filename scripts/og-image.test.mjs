import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";
import { assertPngWithinTolerance, diffPngBuffers } from "./png-diff.mjs";
import {
  OG_HEIGHT,
  OG_LOCKUP_WIDTH,
  OG_THEMES,
  OG_WIDTH,
  ogPath,
  renderOgDefault,
} from "./og-image.mjs";
import { pngSize } from "./png-size.mjs";

const CENTER_SLACK_PX = 2;

/**
 * @param {Buffer} png
 * @param {{ r: number, g: number, b: number }} bg
 */
async function contentBBox(png, bg) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const dr = Math.abs(data[i] - bg.r);
      const dg = Math.abs(data[i + 1] - bg.g);
      const db = Math.abs(data[i + 2] - bg.b);
      if (dr + dg + db > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

test("OG cards are 1200×630 with a centred generous lockup", async () => {
  const backgrounds = {
    dark: { r: 0, g: 0, b: 0 },
    light: { r: 255, g: 255, b: 255 },
  };
  for (const theme of OG_THEMES) {
    const generated = await renderOgDefault(theme);
    const committed = await readFile(ogPath(theme));
    const size = pngSize(committed);
    assert.equal(size.width, OG_WIDTH, `${theme} width`);
    assert.equal(size.height, OG_HEIGHT, `${theme} height`);
    const diff = await diffPngBuffers(committed, generated);
    assertPngWithinTolerance(
      { ...diff, file: `src/og-image/${theme}/og-default.png` },
      { maxPercent: 1, maxMeanAbs: 1 },
    );
    const box = await contentBBox(committed, backgrounds[theme]);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    assert.ok(
      Math.abs(cx - OG_WIDTH / 2) <= CENTER_SLACK_PX,
      `${theme} lockup not centred horizontally (cx=${cx})`,
    );
    assert.ok(
      Math.abs(cy - OG_HEIGHT / 2) <= CENTER_SLACK_PX,
      `${theme} lockup not centred vertically (cy=${cy})`,
    );
    assert.ok(
      Math.abs(box.width - OG_LOCKUP_WIDTH) <= 4,
      `${theme} lockup width ${box.width}px, expected ~${OG_LOCKUP_WIDTH}`,
    );
  }
});
