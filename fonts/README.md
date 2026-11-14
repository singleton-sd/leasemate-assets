# Open Sauce Sans (OFL)

Vendored from [marcologous/Open-Sauce-Fonts](https://github.com/marcologous/Open-Sauce-Fonts)
for deterministic lockup rasterization.

| File | Weight | Use |
| --- | --- | --- |
| `OpenSauceSans-Medium.ttf` | 500 | “LeaseMate” wordmark |
| `OpenSauceSans-SemiBold.ttf` | 600 | “BY SINGLETON SD” caps |
| `OFL.txt` | — | SIL Open Font License |

The build renderer (`scripts/render-svg.mjs`) loads only these files and
disables system fonts, so PNG output cannot silently fall back to another face.
