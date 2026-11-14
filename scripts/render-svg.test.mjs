import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FONT_FAMILY, renderSvgToPng } from "./render-svg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("icon dark 512 matches native 56-unit aspect", async () => {
  const svg = await readFile(join(ROOT, "src/logo/sources/dark.svg"), "utf8");
  const png = renderSvgToPng(svg, { width: 512, height: 512 });
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
});

test("oauth PNG is 120px from the app icon", async () => {
  const svg = await readFile(join(ROOT, "src/logo/sources/app-icon.svg"), "utf8");
  const png = renderSvgToPng(svg, { width: 120, height: 120 });
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 120);
  assert.equal(meta.height, 120);
});

test("stacked 2x is 560×440", async () => {
  const svg = await readFile(
    join(ROOT, "src/logo/wordmark/sources/lockup-stacked/dark.svg"),
    "utf8",
  );
  const png = renderSvgToPng(svg, { width: 560, height: 440 });
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 560);
  assert.equal(meta.height, 440);
});

test("renderer default family is Open Sauce Sans", () => {
  assert.equal(FONT_FAMILY, "Open Sauce Sans");
});
