import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertPublishedSvgOutlined,
  outlineSvgText,
} from "./outline-svg-text.mjs";
import { diffPngBuffers } from "./png-diff.mjs";
import { renderSvgToPng } from "./render-svg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_DIR = join(ROOT, "svg");

const LOCKUPS = [
  {
    src: "src/logo/wordmark/sources/lockup-horizontal/dark.svg",
    width: 840,
    height: 240,
  },
  {
    src: "src/logo/wordmark/sources/lockup-horizontal/light.svg",
    width: 840,
    height: 240,
  },
  {
    src: "src/logo/wordmark/sources/lockup-horizontal/on-dark-transparent.svg",
    width: 840,
    height: 240,
  },
  {
    src: "src/logo/wordmark/sources/lockup-horizontal/on-light-transparent.svg",
    width: 840,
    height: 240,
  },
  {
    src: "src/logo/wordmark/sources/lockup-stacked/dark.svg",
    width: 560,
    height: 440,
  },
  {
    src: "src/logo/wordmark/sources/lockup-stacked/light.svg",
    width: 560,
    height: 440,
  },
];

test("outlineSvgText is a no-op when there is no <text>", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`;
  assert.equal(outlineSvgText(svg), svg);
});

test("outlineSvgText replaces lockup <text> with paths", async () => {
  const src = await readFile(join(ROOT, LOCKUPS[0].src), "utf8");
  assert.match(src, /<text\b/);
  const outlined = outlineSvgText(src);
  assert.doesNotMatch(outlined, /<text[\s>/]/i);
  assert.match(outlined, /<path d="/);
  assert.match(outlined, /fill="#FFFFFF"/);
  assert.match(outlined, /fill="#7F848A"/);
  assert.match(outlined, /#FFB300/);
});

test("outlined lockups rasterize like live-text masters", async () => {
  for (const spec of LOCKUPS) {
    const src = await readFile(join(ROOT, spec.src), "utf8");
    const outlined = outlineSvgText(src);
    const live = renderSvgToPng(src, {
      width: spec.width,
      height: spec.height,
    });
    const paths = renderSvgToPng(outlined, {
      width: spec.width,
      height: spec.height,
    });
    const diff = await diffPngBuffers(live, paths);
    assert.ok(
      diff.percent < 0.05,
      `${spec.src}: outlined vs live-text percent=${diff.percent}`,
    );
  }
});

test("assertPublishedSvgOutlined rejects live text", () => {
  assert.throws(
    () =>
      assertPublishedSvgOutlined(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="8">x</text></svg>`,
        "lockup.svg",
      ),
    /lockup\.svg: published SVG must convert <text> to path outlines/,
  );
  assert.doesNotThrow(() =>
    assertPublishedSvgOutlined(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H10V10H0Z"/></svg>`,
      "icon.svg",
    ),
  );
});

test("published svg/ files contain no <text> elements", async () => {
  const files = (await readdir(SVG_DIR)).filter((name) => name.endsWith(".svg"));
  assert.ok(files.length > 0, "svg/ should contain published files");
  for (const file of files) {
    const svg = await readFile(join(SVG_DIR, file), "utf8");
    assertPublishedSvgOutlined(svg, `svg/${file}`);
  }
});
