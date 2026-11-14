#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncLegacySvg } from "./sync-legacy-svg.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function assertSvgSafe(svg, path) {
  if (!/viewBox\s*=/.test(svg)) {
    throw new Error(`${path}: missing viewBox`);
  }
  if (/<script/i.test(svg) || /\son[a-z]+\s*=/i.test(svg)) {
    throw new Error(`${path}: scripts / event handlers are not allowed`);
  }
  // Strip approved W3C xmlns declarations, then reject any remaining absolute
  // or scheme-relative URLs (e.g. external <image href="https://…">).
  const stripped = svg.replace(
    /\s+xmlns(?::[\w-]+)?\s*=\s*(["'])https?:\/\/www\.w3\.org[^"']*\1/gi,
    "",
  );
  if (/(?:https?:)?\/\//i.test(stripped)) {
    throw new Error(`${path}: external URLs are not allowed`);
  }
}

function assertSingletonPalette(svg, path) {
  const hexes = [...svg.matchAll(/#([0-9A-Fa-f]{3,8})\b/g)].map((m) =>
    m[1].toUpperCase(),
  );
  const allowed = new Set([
    "FFB300",
    "C89200",
    "7F848A",
    "9DA1A6",
    "000000",
    "FFFFFF",
    "000",
    "FFF",
  ]);
  for (const hex of hexes) {
    if (!allowed.has(hex)) {
      throw new Error(`${path}: non-Singleton colour #${hex}`);
    }
  }
}

export { assertSvgSafe, assertSingletonPalette };

const MARK_FILES = [
  "dark.svg",
  "light.svg",
  "mono-black.svg",
  "mono-white.svg",
  "app-icon.svg",
  "favicon.svg",
];

const WORDMARKS = {
  "lockup-horizontal": [
    "dark",
    "light",
    "on-dark-transparent",
    "on-light-transparent",
  ],
  "lockup-stacked": ["dark", "light"],
};

const NAMED_PNG = [
  "leasemate-icon-dark-512.png",
  "leasemate-icon-light-512.png",
  "leasemate-mono-black-512.png",
  "leasemate-mono-white-512.png",
  "leasemate-app-icon-16.png",
  "leasemate-app-icon-32.png",
  "leasemate-app-icon-48.png",
  "leasemate-app-icon-180.png",
  "leasemate-app-icon-512.png",
  "leasemate-app-icon-1024.png",
  "leasemate-oauth-120.png",
  "leasemate-lockup-dark.png",
  "leasemate-lockup-light.png",
  "leasemate-lockup-on-dark-transparent.png",
  "leasemate-lockup-on-light-transparent.png",
  "leasemate-stacked-dark.png",
  "leasemate-stacked-light.png",
  "leasemate-final-sheet.png",
];

export async function validateAssets() {
  const errors = [];

  for (const name of ["meta.json", "config/product.json", "BRAND.md", "AGENTS.md"]) {
    if (!(await exists(join(ROOT, name)))) errors.push(`missing ${name}`);
  }

  for (const file of MARK_FILES) {
    const path = `src/logo/sources/${file}`;
    const full = join(ROOT, path);
    if (!(await exists(full))) {
      errors.push(`missing ${path}`);
      continue;
    }
    try {
      const svg = await readFile(full, "utf8");
      assertSvgSafe(svg, path);
      assertSingletonPalette(svg, path);
    } catch (e) {
      errors.push(e.message);
    }
  }

  for (const [role, themes] of Object.entries(WORDMARKS)) {
    for (const theme of themes) {
      const path = `src/logo/wordmark/sources/${role}/${theme}.svg`;
      const full = join(ROOT, path);
      if (!(await exists(full))) {
        errors.push(`missing ${path}`);
        continue;
      }
      try {
        const svg = await readFile(full, "utf8");
        assertSvgSafe(svg, path);
        assertSingletonPalette(svg, path);
        if (!/Open Sauce Sans/.test(svg)) {
          errors.push(`${path}: lockup must set font-family="Open Sauce Sans"`);
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
  }

  for (const theme of ["dark", "light"]) {
    const path = `src/og-image/${theme}/og-default.png`;
    if (!(await exists(join(ROOT, path)))) errors.push(`missing ${path}`);
  }

  for (const dir of [
    "src/email",
    "src/documents",
    "src/illustrations",
    "src/screenshots",
    "src/marketing",
    "fonts",
  ]) {
    if (!(await exists(join(ROOT, dir)))) errors.push(`missing ${dir}/`);
  }

  for (const font of [
    "fonts/OpenSauceSans-Medium.ttf",
    "fonts/OpenSauceSans-SemiBold.ttf",
    "fonts/OFL.txt",
  ]) {
    if (!(await exists(join(ROOT, font)))) errors.push(`missing ${font}`);
  }

  for (const file of NAMED_PNG) {
    const path = `png/${file}`;
    if (!(await exists(join(ROOT, path)))) errors.push(`missing ${path}`);
  }

  const product = JSON.parse(await readFile(join(ROOT, "config/product.json"), "utf8"));
  if (!product.publicUrl || !/^https:\/\//.test(product.publicUrl)) {
    errors.push("config/product.json publicUrl must be an https URL");
  }

  const mismatches = await syncLegacySvg({ checkOnly: true });
  for (const m of mismatches) errors.push(`legacy svg out of sync: ${m}`);

  return errors;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const errors = await validateAssets();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("assets validate ok");
}
