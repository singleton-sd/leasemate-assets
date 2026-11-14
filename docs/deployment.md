# Deployment — LeaseMate assets CDN

Public catalog: <https://assets.leasemate.poc.singletonsd.com>

`dist/` is published by `.github/workflows/pages.yml` on every push to `main`
(GitHub Actions → Pages). Omit `/dist` from URLs.

## One-time GitHub Pages configuration

Configured on the repository:

| Setting | Value |
| --- | --- |
| Build and deployment | **GitHub Actions** |
| Custom domain | `assets.leasemate.poc.singletonsd.com` |
| Enforce HTTPS | enabled (after certificate approved) |

`config/product.json` → `publicUrl` must match the custom domain. The build
writes a `CNAME` file into `dist/` for documentation; Actions publishing uses
the domain from repository Pages settings.

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
```

Expected DNS: `singleton-sd.github.io.`. HTTPS should succeed with a cert for
`assets.leasemate.poc.singletonsd.com` once the first Pages deploy completes.
