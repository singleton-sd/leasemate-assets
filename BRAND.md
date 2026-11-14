# LeaseMate brand overlay
LeaseMate is a Singleton SD product. It uses Singleton gold/yellow plus neutrals (black, white, grays), with no product accent colour. The default theme is black with bright yellow #FFB300 (dark first); light mode is optional.

## Icon
- 56-unit grid, same as InkAds: a house outline with a 3-unit gold stroke and round joins, plus four flat room blocks. The top-left room is gold (the highlighted room), the top-right is white on dark or black on light, and the bottom two are gray.
- On dark: gold #FFB300, ink #FFFFFF, gray #7F848A. On light: gold #C89200, ink #000000, gray #9DA1A6.
- App/OAuth icon: the dark icon on a black square with 12-unit padding. leasemate-oauth-120.png goes on the Google/Entra consent screens; leasemate-app-icon-16/32/48/180/512/1024.png are favicons and app icons.
- Mono: leasemate-mono-black/white, for sidebars, PDFs and one-colour print.

## Wordmark and lockups
- "LeaseMate" in Open Sauce Sans 500 with -3% tracking, white on dark or black on light. Underneath sits a gold bar (34) next to a gray bar (12), then "BY SINGLETON SD" in 600 caps with +12% tracking in #7F848A. This matches the InkAds lockup.
- Horizontal: leasemate-lockup-dark/light, plus transparent versions. Stacked: leasemate-stacked-dark/light.

## Open Graph (pending Pato)
`src/og-image/dark/og-default.png` and `src/og-image/light/og-default.png` are
1200×630 comps with the horizontal lockup centred on black / white. They are
**pending Pato's approval** and are not approved brand assets yet.

## UI colour = core Singleton tokens
- Dark mode (default): #FFB300 primary fill with black text.
- Light mode: #C89200 fill with black text (hover #B57F00, pressed #A36F00).
- Never use gold as text on white. Links (#8E5C00) and focus (gray-900) arrive in tokens 1.7.0 (pending); this package still pins `@singleton-sd/tokens` 1.5.0 in meta.json.
