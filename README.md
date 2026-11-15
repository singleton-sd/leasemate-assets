# LeaseMate brand assets

SVG masters and generated favicons / PNGs / OG cards for the **LeaseMate** product
mark. Parent brand: [Singleton SD](https://singletonsd.com). LeaseMate uses only
Singleton gold/yellow, black, white and grays — no product accent.

See [BRAND.md](BRAND.md) and `meta.json`.

Package: [`@singleton-sd/leasemate-assets`](https://www.npmjs.com/package/@singleton-sd/leasemate-assets)
(Trusted Publishing / OIDC from GitHub Actions). **Pages CDN is still primary**
for HTML consumers; npm ships a versioned `dist/` + masters for apps. GitHub
Pages is served from the `gh-pages` branch: the site root is the latest
catalog, and each release also publishes an immutable snapshot at
`/releases/<tag>/`.

```sh
pnpm add @singleton-sd/leasemate-assets
```

## Preview

![LeaseMate brand sheet](png/leasemate-final-sheet.png)

## Which file to use where

| Use | File |
| --- | --- |
| Nav / UI icon on black | [`svg/leasemate-icon-dark.svg`](svg/leasemate-icon-dark.svg) or [`png/leasemate-icon-dark-512.png`](png/leasemate-icon-dark-512.png) |
| Nav / UI icon on white | [`svg/leasemate-icon-light.svg`](svg/leasemate-icon-light.svg) or [`png/leasemate-icon-light-512.png`](png/leasemate-icon-light-512.png) |
| Favicon / app icon | [`png/leasemate-app-icon-16.png`](png/leasemate-app-icon-16.png) / [`32`](png/leasemate-app-icon-32.png) / [`48`](png/leasemate-app-icon-48.png) / [`180`](png/leasemate-app-icon-180.png) / [`512`](png/leasemate-app-icon-512.png) / [`1024`](png/leasemate-app-icon-1024.png) (from [`svg/leasemate-app-icon.svg`](svg/leasemate-app-icon.svg)) |
| Google / Entra OAuth consent | [`png/leasemate-oauth-120.png`](png/leasemate-oauth-120.png) |
| Header lockup on black | [`svg/leasemate-lockup-dark.svg`](svg/leasemate-lockup-dark.svg) / [`png/leasemate-lockup-dark.png`](png/leasemate-lockup-dark.png) (2×) |
| Header lockup on white | [`svg/leasemate-lockup-light.svg`](svg/leasemate-lockup-light.svg) / [`png/leasemate-lockup-light.png`](png/leasemate-lockup-light.png) (2×) |
| Lockup over a photo / existing ground | [`svg/leasemate-lockup-on-dark-transparent.svg`](svg/leasemate-lockup-on-dark-transparent.svg) or [`…-on-light-transparent.svg`](svg/leasemate-lockup-on-light-transparent.svg) |
| Centered / square lockup | [`svg/leasemate-stacked-dark.svg`](svg/leasemate-stacked-dark.svg) / [`svg/leasemate-stacked-light.svg`](svg/leasemate-stacked-light.svg) (PNG at 2×) |
| Sidebar / PDF / one-colour print | [`svg/leasemate-mono-black.svg`](svg/leasemate-mono-black.svg) or [`svg/leasemate-mono-white.svg`](svg/leasemate-mono-white.svg) |

Wordmark typeface is **Plus Jakarta Sans** (OFL, Google Fonts): weight **500** for “LeaseMate” and for “BY SINGLETON SD”. Rasterization loads `fonts/` (400 / 500 / 700) and does not fall back to a system font.

## Copy-paste CDN URLs (GitHub Pages)

`dist/` is served at site root (omit `/dist`):

Base: **https://assets.leasemate.poc.singletonsd.com**

| Asset | URL |
| --- | --- |
| Favicon 32 | `https://assets.leasemate.poc.singletonsd.com/favicons/favicon-32x32.png` |
| Apple touch | `https://assets.leasemate.poc.singletonsd.com/favicons/apple-touch-icon.png` |
| Web manifest | `https://assets.leasemate.poc.singletonsd.com/favicons/site.webmanifest` |
| OG (dark, pending Pato) | `https://assets.leasemate.poc.singletonsd.com/og-image/dark/og-default.png` |
| Icon SVG (nav) | `https://assets.leasemate.poc.singletonsd.com/svg/leasemate-icon-dark.svg` |
| Lockup SVG (nav) | `https://assets.leasemate.poc.singletonsd.com/svg/leasemate-lockup-on-dark-transparent.svg` |
| Icon PNG 512 | `https://assets.leasemate.poc.singletonsd.com/png/leasemate-icon-dark-512.png` |
| OAuth 120 | `https://assets.leasemate.poc.singletonsd.com/png/leasemate-oauth-120.png` |

Pinned snapshot (same file after a release tag `0.1.0`):
`https://assets.leasemate.poc.singletonsd.com/releases/0.1.0/png/leasemate-icon-dark-512.png`

DNS + Pages setup: [`docs/deployment.md`](docs/deployment.md).

Open Graph cards in `src/og-image/` are **pending Pato's approval**. They are
centred 1200×630 lockup comps, not approved masters — do not treat them as
signed-off brand assets until he reviews them.

## Legacy jsDelivr (pinned commit)

Marketing and other consumers may still load vectors from a **pinned SHA**
(not `@main`):

```text
https://cdn.jsdelivr.net/gh/singleton-sd/leasemate-assets@<sha>/svg/<file>
```

Root `svg/` is kept in sync with `src/` via `npm run sync:legacy-svg`.

Example icon:

`https://cdn.jsdelivr.net/gh/singleton-sd/leasemate-assets@<sha>/svg/leasemate-icon-dark.svg`

## Develop

```sh
pnpm install
pnpm validate
pnpm test
pnpm build   # writes dist/ (gitignored)
```

Requires Node 22 (`.nvmrc`) and pnpm 11 (`packageManager` field).

Release (CI only): `pnpm release:ci` via `.github/workflows/release.yml`.
The push uses the singleton-release GitHub App (`vars.RELEASE_APP_ID` +
`secrets.RELEASE_APP_PRIVATE_KEY`). Do not use `GITHUB_TOKEN` or a PAT.
Local dry-run: `pnpm release`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```text
src/                 # masters (edit here)
svg/                 # named SVG handoff (synced from src)
png/                 # named PNG handoff (approved rasters)
fonts/               # Plus Jakarta Sans 400/500/700 (OFL)
scripts/             # validate + build
dist/                # generated — Pages publishes this
config/product.json  # publicUrl + identity
meta.json            # inventory contract
```

## Related

- [BRAND.md](BRAND.md)
- Blueprint: GitLab `@singleton-sd/assets`
- Sibling: [poc-inkads-assets](https://github.com/singleton-sd/poc-inkads-assets)
- Workflow: [docs/logo-asset-workflow.md](docs/logo-asset-workflow.md)
