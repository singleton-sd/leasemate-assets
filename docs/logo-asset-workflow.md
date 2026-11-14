# Logo asset workflow (LeaseMate)

## Masters

1. Update SVG under `src/logo/…` (or OG under `src/og-image/…`).
2. Run `npm run sync:legacy-svg` so root `svg/` matches (named-file CDN).
3. Run `npm run validate && npm run build`.
4. Commit `src/` + synced `svg/` (never commit `dist/`).
5. If a named raster must match an approved comp, update `png/` and commit it.

## Build outputs

| Dist path | Source |
| --- | --- |
| `favicons/*` | `src/logo/sources/app-icon.svg` |
| `logo/static/{theme}/{size}.png` | `src/logo/sources/{theme}.svg` |
| `logo/wordmark/{role}/{theme}/*` | lockup SVG masters (+ PNG widths) |
| `png/leasemate-*.png` | named raster handoff (2× lockups; app/OAuth sizes) |
| `og-image/{theme}/og-default.png` | `src/og-image/…` |
| `svg/**` | full vector mirror for Pages |
| `manifest.json` | SHA-256 inventory of `dist/` |

Lockup text is rasterized with vendored **Open Sauce Sans** (`fonts/`). The
renderer disables system fonts so the wordmark cannot fall back.

## CDN

Pages deploys `dist/` to the site root (`config/product.json` → `publicUrl`).
Omit `/dist` from URLs.

Legacy (pinned commit, no Pages required):

```text
https://cdn.jsdelivr.net/gh/singleton-sd/leasemate-assets@<sha>/svg/leasemate-icon-dark.svg
```

## Follow-ups

- Email / documents packs.
- Point product apps at Pages URLs (`https://assets.leasemate.poc.singletonsd.com/…`).

## npm package

Pages CDN is primary for HTML consumers. `@singleton-sd/leasemate-assets`
publishes via GitHub Actions Trusted Publishing (OIDC) —
`.github/workflows/release.yml` / `pnpm release:ci`. Do not add `NPM_TOKEN`.
