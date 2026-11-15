#!/usr/bin/env node
/**
 * Mirror src/ logo SVGs into root svg/ using the public LeaseMate filenames.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { outlineSvgText } from "./outline-svg-text.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Array<[string, string]>} */
const MAP = [
  ["src/logo/sources/dark.svg", "svg/leasemate-icon-dark.svg"],
  ["src/logo/sources/light.svg", "svg/leasemate-icon-light.svg"],
  ["src/logo/sources/mono-black.svg", "svg/leasemate-mono-black.svg"],
  ["src/logo/sources/mono-white.svg", "svg/leasemate-mono-white.svg"],
  ["src/logo/sources/app-icon.svg", "svg/leasemate-app-icon.svg"],
  [
    "src/logo/wordmark/sources/lockup-horizontal/dark.svg",
    "svg/leasemate-lockup-dark.svg",
  ],
  [
    "src/logo/wordmark/sources/lockup-horizontal/light.svg",
    "svg/leasemate-lockup-light.svg",
  ],
  [
    "src/logo/wordmark/sources/lockup-horizontal/on-dark-transparent.svg",
    "svg/leasemate-lockup-on-dark-transparent.svg",
  ],
  [
    "src/logo/wordmark/sources/lockup-horizontal/on-light-transparent.svg",
    "svg/leasemate-lockup-on-light-transparent.svg",
  ],
  [
    "src/logo/wordmark/sources/lockup-stacked/dark.svg",
    "svg/leasemate-stacked-dark.svg",
  ],
  [
    "src/logo/wordmark/sources/lockup-stacked/light.svg",
    "svg/leasemate-stacked-light.svg",
  ],
];

export async function syncLegacySvg({
  checkOnly = false,
  root = ROOT,
  map = MAP,
} = {}) {
  const mismatches = [];
  for (const [from, to] of map) {
    const src = await readFile(join(root, from), "utf8");
    const expected = outlineSvgText(src);
    const destPath = join(root, to);
    if (checkOnly) {
      let dest;
      try {
        dest = await readFile(destPath, "utf8");
      } catch {
        mismatches.push(to);
        continue;
      }
      if (dest !== expected) mismatches.push(to);
      continue;
    }
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, expected);
  }
  return mismatches;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const checkOnly = process.argv.includes("--check");
  const mismatches = await syncLegacySvg({ checkOnly });
  if (checkOnly) {
    if (mismatches.length) {
      console.error("legacy svg/ out of sync with src/:\n" + mismatches.join("\n"));
      process.exit(1);
    }
    console.log("legacy svg/ matches outlined src/");
  } else {
    console.log(`synced ${MAP.length} files -> svg/ (lockup text outlined)`);
  }
}
