# Plus Jakarta Sans (OFL)

Vendored from
[google/fonts `ofl/plusjakartasans`](https://github.com/google/fonts/tree/main/ofl/plusjakartasans)
for deterministic lockup rasterization. Static instances of weights **400**,
**500**, and **700** are taken from that OFL source (the folder ships the
variable font; Regular / Medium / Bold are the static files the build loads).

| File | Weight | Use |
| --- | --- | --- |
| `PlusJakartaSans-Regular.ttf` | 400 | vendored for the rasterizer |
| `PlusJakartaSans-Medium.ttf` | 500 | “LeaseMate” wordmark and “BY SINGLETON SD” caps |
| `PlusJakartaSans-Bold.ttf` | 700 | vendored for the rasterizer |
| `OFL.txt` | — | SIL Open Font License |

The build renderer (`scripts/render-svg.mjs`) loads only these files and
disables system fonts, so PNG output cannot silently fall back to another face.
