# Contributing

## Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
messages and PR titles. The next published version is computed from the latest
git tag plus these commits (`feat` → minor, `fix` → patch,
`BREAKING CHANGE` → major).

Do not bump `package.json` or edit `CHANGELOG.md` in a feature PR for the sake
of releasing. The release workflow does that on merge to `main`.

## Releases

On merge to `main` (or `workflow_dispatch` from `main`), `.github/workflows/release.yml`
splits prepare (no App token) from publish:

1. Compute the next version from the latest `X.Y.Z` tag plus conventional
   commits. Git tags in this repo are unprefixed (`0.1.0`); GitHub Release
   titles use `vX.Y.Z`.
2. Bump `package.json` and write `CHANGELOG.md`. Record the `origin/main` SHA.
3. The publish job verifies prepare's artifact with bash/git/jq/tar (no
   `node` / `pnpm` / `npx`), then commits `chore(release): vX.Y.Z [skip ci]`,
   creates an annotated `X.Y.Z` tag, and pushes `HEAD:main` plus
   `refs/tags/X.Y.Z` with the App token in `git extraheader` (not the origin
   URL). A non-fast-forward push fails rather than overwriting `package.json`.
   If the tag is already on GitHub, recover with `workflow_dispatch`
   `recover_version` + `recover_sha` (the parent of the release commit).
4. Publish `@singleton-sd/leasemate-assets` to npm via Trusted Publishing (OIDC).
   Do not add `NPM_TOKEN`.
5. Re-derive the GitHub Release notes from the verified CHANGELOG section
   for that version (do not trust prepare's `release-notes.md` unless it
   matches byte for byte) and create the release with `gh release create`.
6. `.github/workflows/snapshot.yml` runs on `release: published` (not tag
   push). It publishes an immutable `gh-pages` snapshot at
   `/releases/<tag>/`, refuses to overwrite that directory if it already
   exists, and attaches `leasemate-assets-<tag>.tar.gz`, the SHA-256
   checksum, and `dist/manifest.json` to the GitHub Release. A retry
   skips assets that already match byte for byte, fails if an existing
   asset differs, and uploads only the missing ones — it never replaces.
   It does not
   deploy to the Pages root: the latest catalog is published by
   `pages.yml` from `main`. Backfilling an older tag must not replace
   current assets at site root.

The git push uses the **singleton-release** GitHub App
(`vars.RELEASE_APP_ID` + `secrets.RELEASE_APP_PRIVATE_KEY`), which is on the
default-branch ruleset bypass list. Do not use `GITHUB_TOKEN` or a PAT for
that push — `GITHUB_TOKEN` cannot bypass the CodeRabbit required ruleset
(GH013). Checkout, `pnpm install`, and validate/test/build/sync stay
unauthenticated in the prepare job. The App token is minted last in the
publish job (no install, no repo scripts) and used only via `git extraheader`,
`gh`, and npm OIDC. npm publish uses `--ignore-scripts` so `prepublishOnly`
does not re-run. Publish jobs that mint the App token reject
`workflow_dispatch` unless the ref is `main`, and are attached to the GitHub
Environment named `release` so required reviewers and deployment-branch rules
can be set in the repo. Snapshot publish also runs on `release: published`
(a tag ref); environment branch rules must allow those tags.

The job is skipped when the head commit message starts with `chore(release):`,
so the release commit does not loop.

Local dry-run: `pnpm release`.
