import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertSingletonPalette,
  assertSvgSafe,
  validateAssets,
} from "./validate-assets.mjs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSvgToPng } from "./render-svg.mjs";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("validateAssets reports no errors on current tree", async () => {
  const errors = await validateAssets();
  assert.deepEqual(errors, []);
});

test("product publicUrl is the assets CDN host", async () => {
  const product = JSON.parse(
    await readFile(join(ROOT, "config/product.json"), "utf8"),
  );
  assert.equal(product.publicUrl, "https://assets.leasemate.poc.singletonsd.com");
  assert.match(product.id, /leasemate/i);
});

test("meta.json declares dark/light and both mono themes", async () => {
  const meta = JSON.parse(await readFile(join(ROOT, "meta.json"), "utf8"));
  assert.ok(meta.themes.includes("dark"));
  assert.ok(meta.themes.includes("light"));
  assert.ok(meta.themes.includes("mono-black"));
  assert.ok(meta.themes.includes("mono-white"));
  assert.ok(meta.roles.includes("lockup-horizontal"));
  assert.ok(meta.roles.includes("lockup-stacked"));
});

test("meta.json maps brand hex to @singleton-sd/tokens ids", async () => {
  const meta = JSON.parse(await readFile(join(ROOT, "meta.json"), "utf8"));
  assert.equal(meta.tokens?.package, "@singleton-sd/tokens");
  assert.match(String(meta.tokens?.version ?? ""), /^\d+\.\d+\.\d+/);
  assert.equal(meta.colors.yellowDark500.tokenId, "yellow-dark-500");
  assert.equal(meta.colors.yellowDark500.hex.toUpperCase(), "#FFB300");
  assert.equal(meta.colors.yellowLight500.tokenId, "yellow-light-500");
  assert.equal(meta.colors.gray500.tokenId, "gray-600");
  assert.equal(meta.colors.gray300.tokenId, "gray-300");
  assert.equal(meta.colors.grayLight500.hex.toUpperCase(), "#9DA1A6");
  assert.equal(meta.font.family, "Open Sauce Sans");
});

test("assertSvgSafe rejects external href even with xmlns", () => {
  const evil = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <image href="https://attacker.example/x.png"/>
</svg>`;
  assert.throws(
    () => assertSvgSafe(evil, "fixture.svg"),
    /external URLs are not allowed/,
  );
});

test("assertSvgSafe allows W3C xmlns without other URLs", () => {
  const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect width="10" height="10"/>
</svg>`;
  assert.doesNotThrow(() => assertSvgSafe(ok, "fixture.svg"));
});

test("assertSvgSafe rejects namespace-prefixed script elements", () => {
  const evil = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <s:script>alert(1)</s:script>
</svg>`;
  assert.throws(
    () => assertSvgSafe(evil, "fixture.svg"),
    /scripts \/ event handlers are not allowed/,
  );
});

test("assertSvgSafe rejects animated href assignments", () => {
  const evil = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <a href="#">
    <set attributeName="href" to="javascript:alert(1)" begin="0s"/>
    <rect width="10" height="10"/>
  </a>
</svg>`;
  assert.throws(
    () => assertSvgSafe(evil, "fixture.svg"),
    /SVG animation elements are not allowed/,
  );
});

test("assertSvgSafe rejects javascript: href variants", () => {
  const wrap = (href) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a href="${href}"><rect width="10" height="10"/></a></svg>`;
  const cases = [
    `javascript:alert(1)`,
    `javascript:alert('1')`,
    `javascript&#58;alert(1)`,
    `&#x6A;avascript:alert(1)`,
    `java&#x09;script:alert(1)`,
  ];
  for (const href of cases) {
    assert.throws(
      () => assertSvgSafe(wrap(href), "fixture.svg"),
      /executable URI schemes are not allowed/,
      href,
    );
  }
});

test("assertSingletonPalette rejects non-Singleton accents", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect fill="#00AAFF" width="10" height="10"/>
</svg>`;
  assert.throws(
    () => assertSingletonPalette(svg, "fixture.svg"),
    /non-Singleton colour/,
  );
});

test("assertSingletonPalette rejects rgb and named accent colours", () => {
  const rgb = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect fill="rgb(0,170,255)" width="10" height="10"/>
</svg>`;
  const named = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect fill="deepskyblue" width="10" height="10"/>
</svg>`;
  assert.throws(() => assertSingletonPalette(rgb, "rgb.svg"), /non-Singleton colour/);
  assert.throws(() => assertSingletonPalette(named, "named.svg"), /non-Singleton colour/);
});

test("lockup rasterizer paints Open Sauce Sans glyphs", async () => {
  const svg = await readFile(
    join(ROOT, "src/logo/wordmark/sources/lockup-horizontal/dark.svg"),
    "utf8",
  );
  const png = renderSvgToPng(svg, { width: 840, height: 240 });
  // Wordmark sits to the right of the 56-unit icon (2×: x≈208, y≈90–160).
  const { data, info } = await sharp(png)
    .extract({ left: 220, top: 90, width: 300, height: 70 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
  }
  assert.ok(
    white > 800,
    `wordmark crop should contain glyphs (white pixels=${white})`,
  );
  const missingFont = svg.replaceAll("Open Sauce Sans", "DefinitelyMissingFont");
  assert.throws(
    () => renderSvgToPng(missingFont, { width: 840, height: 240 }),
    /must use font-family/,
  );
});
