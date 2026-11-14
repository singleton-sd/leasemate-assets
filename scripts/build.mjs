#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import toIco from "to-ico";
import { renderSvgToPng } from "./render-svg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SRC = join(ROOT, "src");
const PNG = join(ROOT, "png");

const ICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
const CI = process.env.CI === "true";
const LOCKUP_WIDTHS = CI ? [840, 1280] : [840, 1280, 2560];

const NAMED_RASTERS = [
  { svg: "src/logo/sources/dark.svg", file: "leasemate-icon-dark-512.png", width: 512, height: 512 },
  { svg: "src/logo/sources/light.svg", file: "leasemate-icon-light-512.png", width: 512, height: 512 },
  { svg: "src/logo/sources/mono-black.svg", file: "leasemate-mono-black-512.png", width: 512, height: 512 },
  { svg: "src/logo/sources/mono-white.svg", file: "leasemate-mono-white-512.png", width: 512, height: 512 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-16.png", width: 16, height: 16 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-32.png", width: 32, height: 32 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-48.png", width: 48, height: 48 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-180.png", width: 180, height: 180 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-512.png", width: 512, height: 512 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-app-icon-1024.png", width: 1024, height: 1024 },
  { svg: "src/logo/sources/app-icon.svg", file: "leasemate-oauth-120.png", width: 120, height: 120 },
  {
    svg: "src/logo/wordmark/sources/lockup-horizontal/dark.svg",
    file: "leasemate-lockup-dark.png",
    width: 840,
    height: 240,
  },
  {
    svg: "src/logo/wordmark/sources/lockup-horizontal/light.svg",
    file: "leasemate-lockup-light.png",
    width: 840,
    height: 240,
  },
  {
    svg: "src/logo/wordmark/sources/lockup-horizontal/on-dark-transparent.svg",
    file: "leasemate-lockup-on-dark-transparent.png",
    width: 840,
    height: 240,
  },
  {
    svg: "src/logo/wordmark/sources/lockup-horizontal/on-light-transparent.svg",
    file: "leasemate-lockup-on-light-transparent.png",
    width: 840,
    height: 240,
  },
  {
    svg: "src/logo/wordmark/sources/lockup-stacked/dark.svg",
    file: "leasemate-stacked-dark.png",
    width: 560,
    height: 440,
  },
  {
    svg: "src/logo/wordmark/sources/lockup-stacked/light.svg",
    file: "leasemate-stacked-light.png",
    width: 560,
    height: 440,
  },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function writePngBuf(buf, path) {
  await ensureDir(dirname(path));
  await writeFile(path, buf);
}

async function buildFavicons(appIconPngs) {
  const out = join(DIST, "favicons");
  await ensureDir(out);

  const fav16 = appIconPngs.get(16);
  const fav32 = appIconPngs.get(32);
  const fav48 = appIconPngs.get(48);

  await writeFile(join(out, "favicon-16x16.png"), fav16);
  await writeFile(join(out, "favicon-32x32.png"), fav32);
  await writeFile(join(out, "favicon.ico"), await toIco([fav16, fav32, fav48]));
  await writeFile(join(out, "apple-touch-icon.png"), appIconPngs.get(180));
  await writeFile(join(out, "android-chrome-192x192.png"), appIconPngs.get(192));
  await writeFile(join(out, "android-chrome-512x512.png"), appIconPngs.get(512));

  const product = JSON.parse(
    await readFile(join(ROOT, "config/product.json"), "utf8"),
  );
  const manifest = {
    name: product.name,
    short_name: product.shortName,
    icons: [
      {
        src: "./android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "./android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    theme_color: product.themeColor,
    background_color: product.backgroundColor,
    display: "standalone",
  };
  await writeFile(join(out, "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
}

async function buildStaticMarks() {
  for (const theme of ["dark", "light", "mono-black", "mono-white", "app-icon"]) {
    const svg = await readFile(join(SRC, "logo/sources", `${theme}.svg`), "utf8");
    for (const size of ICON_SIZES) {
      const png = renderSvgToPng(svg, { width: size, height: size });
      await writePngBuf(png, join(DIST, "logo/static", theme, `${size}.png`));
    }
    await ensureDir(join(DIST, "logo/static", theme));
    await writeFile(join(DIST, "logo/static", theme, `${theme}.svg`), svg);
  }
}

async function buildWordmarks() {
  const roles = {
    "lockup-horizontal": [
      "dark",
      "light",
      "on-dark-transparent",
      "on-light-transparent",
    ],
    "lockup-stacked": ["dark", "light"],
  };

  for (const [role, themes] of Object.entries(roles)) {
    for (const theme of themes) {
      const svgPath = join(SRC, "logo/wordmark/sources", role, `${theme}.svg`);
      const svg = await readFile(svgPath, "utf8");
      const outDir = join(DIST, "logo/wordmark", role, theme);
      await ensureDir(outDir);
      await writeFile(join(outDir, `${theme}.svg`), svg);

      for (const width of LOCKUP_WIDTHS) {
        // Height follows the SVG viewBox; do not pin it (non-integer scales).
        const png = renderSvgToPng(svg, { width });
        await writePngBuf(png, join(outDir, `${width}.png`));
      }
    }
  }
}

async function buildNamedRasters() {
  const outDir = join(DIST, "png");
  await ensureDir(outDir);
  const report = [];

  for (const spec of NAMED_RASTERS) {
    const svg = await readFile(join(ROOT, spec.svg), "utf8");
    const generated = renderSvgToPng(svg, {
      width: spec.width,
      height: spec.height,
    });
    const approvedPath = join(PNG, spec.file);
    let out = generated;
    let source = "generated";
    try {
      const approved = await readFile(approvedPath);
      if (!approved.equals(generated)) {
        // Approved comps win when the rasterizer cannot match them exactly
        // (antialiasing / PNG encoder). Text still went through Open Sauce Sans.
        out = approved;
        source = "approved";
      }
    } catch {
      source = "generated (no approved file)";
    }
    await writePngBuf(out, join(outDir, spec.file));
    report.push(`${spec.file}: ${source} (${spec.width}×${spec.height})`);
  }

  await cp(
    join(PNG, "leasemate-final-sheet.png"),
    join(outDir, "leasemate-final-sheet.png"),
  );
  report.push("leasemate-final-sheet.png: approved (composite sheet)");
  return report;
}

async function copyOg() {
  await cp(join(SRC, "og-image"), join(DIST, "og-image"), { recursive: true });
}

async function copyVectorsToDist() {
  await cp(join(ROOT, "svg"), join(DIST, "svg"), { recursive: true });
}

async function walkFiles(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walkFiles(full, base, acc);
    else acc.push(full);
  }
  return acc;
}

async function writeManifest() {
  const files = await walkFiles(DIST);
  const entries = {};
  for (const full of files.sort()) {
    const rel = relative(DIST, full).replaceAll("\\", "/");
    if (rel === "manifest.json" || rel === "index.html") continue;
    const buf = await readFile(full);
    entries[rel] = {
      bytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
  }
  await writeFile(
    join(DIST, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), files: entries }, null, 2) +
      "\n",
  );
}

async function writeCatalogHtml() {
  const product = JSON.parse(
    await readFile(join(ROOT, "config/product.json"), "utf8"),
  );
  const base = product.publicUrl.replace(/\/$/, "");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${product.name} brand assets</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 2rem; background: #0b0b0c; color: #f2f2f2; line-height: 1.5; }
    a { color: #ffb300; }
    code, pre { font-family: ui-monospace, monospace; font-size: 0.9rem; }
    pre { background: #161618; padding: 1rem; overflow: auto; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; max-width: 52rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #2a2a2e; }
    img { max-height: 48px; background: #111; padding: 4px; border-radius: 4px; }
    .sheet { max-height: none; max-width: 52rem; height: auto; background: #d8d8d8; }
    .on-light { background: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${product.name} assets</h1>
  <p>Parent brand: Singleton SD. Catalog from <code>dist/</code> (omit <code>/dist</code> in URLs).</p>
  <p>Base: <a href="${base}/"><code>${base}</code></a></p>

  <h2>Copy-paste CDN URLs</h2>
  <table>
    <tr><th>Asset</th><th>URL</th></tr>
    <tr><td>Favicon 32</td><td><code>${base}/favicons/favicon-32x32.png</code></td></tr>
    <tr><td>Apple touch</td><td><code>${base}/favicons/apple-touch-icon.png</code></td></tr>
    <tr><td>OAuth 120</td><td><code>${base}/png/leasemate-oauth-120.png</code></td></tr>
    <tr><td>OG (dark)</td><td><code>${base}/og-image/dark/og-default.png</code></td></tr>
    <tr><td>Icon SVG (nav)</td><td><code>${base}/svg/leasemate-icon-dark.svg</code></td></tr>
    <tr><td>Lockup SVG (nav)</td><td><code>${base}/svg/leasemate-lockup-on-dark-transparent.svg</code></td></tr>
    <tr><td>Icon PNG 512</td><td><code>${base}/png/leasemate-icon-dark-512.png</code></td></tr>
  </table>

  <h2>Previews</h2>
  <p>
    <img src="./png/leasemate-icon-dark-512.png" alt="icon dark" width="48" height="48" />
    <img class="on-light" src="./png/leasemate-icon-light-512.png" alt="icon light" width="48" height="48" />
    <img src="./png/leasemate-app-icon-48.png" alt="app icon" width="48" height="48" />
    <img src="./png/leasemate-lockup-dark.png" alt="lockup dark" height="40" />
  </p>
  <p><img class="sheet" src="./png/leasemate-final-sheet.png" alt="LeaseMate brand sheet" /></p>

  <h2>Legacy jsDelivr</h2>
  <pre>https://cdn.jsdelivr.net/gh/singleton-sd/leasemate-assets@&lt;sha&gt;/svg/leasemate-icon-dark.svg</pre>
  <p>See repo README and <a href="https://github.com/singleton-sd/leasemate-assets">GitHub</a>.</p>
</body>
</html>
`;
  await writeFile(join(DIST, "index.html"), html);
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  const appIconSvg = await readFile(join(SRC, "logo/sources/app-icon.svg"), "utf8");
  const appIconPngs = new Map();
  for (const size of ICON_SIZES) {
    appIconPngs.set(size, renderSvgToPng(appIconSvg, { width: size, height: size }));
  }
  // favicon android-chrome-192
  if (!appIconPngs.has(192)) {
    appIconPngs.set(192, renderSvgToPng(appIconSvg, { width: 192, height: 192 }));
  }

  await buildFavicons(appIconPngs);
  await buildStaticMarks();
  await buildWordmarks();
  const namedReport = await buildNamedRasters();
  await copyOg();
  await copyVectorsToDist();
  await writeCatalogHtml();
  const product = JSON.parse(
    await readFile(join(ROOT, "config/product.json"), "utf8"),
  );
  const host = new URL(product.publicUrl).hostname;
  await writeFile(join(DIST, "CNAME"), `${host}\n`);
  await writeManifest();

  const files = await walkFiles(DIST);
  console.log(`build complete -> dist/ (${files.length} files)`);
  for (const line of namedReport) console.log(`  ${line}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
