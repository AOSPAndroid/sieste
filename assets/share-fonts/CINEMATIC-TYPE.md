# Cinematic share lettering

These source fonts are used at build time to generate six separate, on-demand
vector glyph assets. Source files are not sent to the browser. The generated
SVG paths preserve each face's natural advance widths and proportions, including
lowercase metric units, numerals, punctuation, and Latin accented characters.
Variable fonts are instantiated in memory at the exact axes listed below.
Outline coordinates retain 1/1000 font-unit precision to remove verbose
variation floats without changing the visible lettering.

| Key | Face | Instance | Source | Included license |
| --- | --- | --- | --- | --- |
| `oswald` | Oswald | SemiBold, weight 600 | [Google Fonts / Oswald](https://github.com/google/fonts/tree/main/ofl/oswald) · `Oswald[wght].ttf` | `Oswald-OFL.txt` · SIL OFL 1.1 |
| `action` | Barlow Condensed | SemiBold Italic, weight 600 | [Google Fonts / Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed) · `BarlowCondensed-SemiBoldItalic.ttf` | `BarlowCondensed-OFL.txt` · SIL OFL 1.1 |
| `poster` | Teko | SemiBold, weight 600 | [Google Fonts / Teko](https://github.com/google/fonts/tree/main/ofl/teko) · `Teko[wght].ttf` | `Teko-OFL.txt` · SIL OFL 1.1 |
| `widescreen` | Syncopate | Bold, weight 700 | [Google Fonts / Syncopate](https://github.com/google/fonts/tree/main/apache/syncopate) · `Syncopate-Bold.ttf` | `Syncopate-LICENSE.txt` · Apache License 2.0 |
| `cinema` | Bodoni Moda | SemiBold, weight 600; optical size 32 | [Google Fonts / Bodoni Moda](https://github.com/google/fonts/tree/main/ofl/bodonimoda) · `BodoniModa[opsz,wght].ttf` | `BodoniModa-OFL.txt` · SIL OFL 1.1 |
| `modern` | Space Grotesk | Bold, weight 700 | [Google Fonts / Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) · `SpaceGrotesk[wght].ttf` | `SpaceGrotesk-OFL.txt` · SIL OFL 1.1 |

Sources and accompanying licenses were retrieved from the official
`google/fonts` repository on 12 October 2026. Files are retained unmodified.
Syncopate's lowercase letters are small capitals by design; its lowercase
codepoints remain present, so compact metric units can be exported as vector
glyphs without substituting a device font.

Regenerate with `python scripts/generate-share-cinematic-fonts.py` after installing
`fontTools`. The script writes `public/share-assets/fonts/reference-<key>.json`
and refreshes the content-hashed URLs in `app/share-asset-index.ts` through
`scripts/package-share-assets.mjs --index`. Only the chosen face is loaded by the
share editor. Unsupported scripts use the renderer's escaped text fallback.
