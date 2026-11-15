# Agent working agreements — LeaseMate assets

Cross-agent instructions for work in `leasemate-assets`.

## Scope

This repo owns **LeaseMate product mark binaries** (SVG masters + generated
favicons / rasters / OG). It is not the Singleton SD company assets package
(`@singleton-sd/assets`). LeaseMate is a Singleton overlay: gold/yellow, black,
white and grays only — no product accent colour.

## Source of truth

- Edit masters under `src/` only.
- Do not hand-edit `dist/`.
- Keep root `svg/` in sync with `src/` via `npm run sync:legacy-svg` (jsDelivr /
  named-file compatibility until consumers move to Pages CDN).
- Named raster handoff lives in `png/`. Rebuild with `pnpm build` (Plus Jakarta
  Sans from `fonts/`; system fonts are disabled). If a generated PNG does not
  match the approved file, the approved raster in `png/` wins.
- `src/og-image/` Open Graph cards are pending Pato's approval — not approved
  masters. Pages latest catalog lives on `gh-pages`; each GitHub Release also
  publishes an immutable `/releases/<tag>/` snapshot.

## Commits / PRs

- Branch from latest `origin/main` in a dedicated worktree:
  `feat/<issue>-<kebab-title>` (or `fix/` / `docs/`).
- Prefer conventional commits with the GitHub issue: `feat: #1 …`.
- Open a PR for human review; do not merge.

## Build / verify

```sh
pnpm install
pnpm validate
pnpm test
pnpm build
```

CI must leave `src/` and `svg/` unchanged (`git diff` clean after build).
Releases (`pnpm release:ci` via `.github/workflows/release.yml`) commit the
version bump and `CHANGELOG.md` to `main` using the **singleton-release**
GitHub App (`vars.RELEASE_APP_ID` + `secrets.RELEASE_APP_PRIVATE_KEY`) so
the push can bypass the CodeRabbit required ruleset. Do not use
`GITHUB_TOKEN` or a PAT for that push. Do not add `NPM_TOKEN` (OIDC Trusted
Publishing). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Related

- [BRAND.md](BRAND.md)
- [docs/logo-asset-workflow.md](docs/logo-asset-workflow.md)
- Company blueprint: `singleton-sd/design-system/assets`
