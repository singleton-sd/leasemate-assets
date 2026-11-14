# Deployment — LeaseMate assets CDN

Public catalog: <https://assets.leasemate.poc.singletonsd.com>

`dist/` is published to the `gh-pages` branch by `.github/workflows/pages.yml`
on every push to `main`. The site root is the latest catalog. Each GitHub
Release also publishes an immutable snapshot at `/releases/<tag>/` via
`.github/workflows/snapshot.yml` (`release: published`, not tag push — the
release commit is `chore(release): vX [skip ci]`). Omit `/dist` from URLs.

```text
https://assets.leasemate.poc.singletonsd.com/png/leasemate-icon-dark-512.png
https://assets.leasemate.poc.singletonsd.com/releases/0.1.0/png/leasemate-icon-dark-512.png
```

The snapshot job refuses to overwrite an existing `releases/<tag>/` on
`gh-pages`, and attaches `leasemate-assets-<tag>.tar.gz`, its SHA-256, and
`manifest.json` to the GitHub Release.

## One-time GitHub Pages configuration

Configured on the repository:

| Setting | Value |
| --- | --- |
| Build and deployment | **Deploy from a branch** |
| Branch | `gh-pages` / `/` (root) |
| Custom domain | `assets.leasemate.poc.singletonsd.com` |
| Enforce HTTPS | enabled (after certificate approved) |

Do **not** use “GitHub Actions” as the Pages source. The workflow pushes the
built catalog to `gh-pages` so `/releases/<tag>/` can sit beside the latest
root.

`config/product.json` → `publicUrl` must match the custom domain. The build
writes a `CNAME` file into `dist/`.

## AWS Route 53 record

In the public `singletonsd.com` hosted zone (`Z2PHDBJIVYBXRT`), create:

| Name | Type | Value | TTL |
| --- | --- | --- | --- |
| `assets.leasemate.poc.singletonsd.com` | `CNAME` | `singleton-sd.github.io` | `300` |

Same pattern as InkAds (`assets.inkads.poc.singletonsd.com`).

## Verification

```sh
# DNS
python3 -c "import json,urllib.request; print(json.load(urllib.request.urlopen('https://dns.google/resolve?name=assets.leasemate.poc.singletonsd.com&type=CNAME')))"

curl --fail --head https://assets.leasemate.poc.singletonsd.com/
curl --fail --head https://assets.leasemate.poc.singletonsd.com/releases/0.1.0/manifest.json
```

Expected DNS: `singleton-sd.github.io.`. HTTPS should succeed with a cert for
`assets.leasemate.poc.singletonsd.com` once the first `gh-pages` deploy
completes.
