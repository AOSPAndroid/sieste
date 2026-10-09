# Reference sticker lettering

The reference sticker collection uses Archivo Black for the broad sans-serif
headlines and Kalam Light for the handwritten distance. Both are distributed
under their accompanying SIL Open Font License files. Their unmodified sources
are the official Google Fonts repository:

- https://github.com/google/fonts/tree/main/ofl/archivoblack
- https://github.com/google/fonts/tree/main/ofl/kalam

`ArchivoBlack-Regular.ttf` and `Kalam-Light.ttf` are build-time sources, not
browser downloads. `scripts/generate-share-reference-fonts.py` creates the Latin
glyph outlines in `app/share-reference-glyphs.json`. The module
`app/share-reference-type.ts` combines these with the already licensed Anton
and Caprasimo outlines documented in `README.md`. The existing Caprasimo
statistic subset and its 0.94 advance adjustment are reused directly, without
duplicating glyph assets. This face supports lowercase units and numeric
headlines; uppercase or missing-script characters retain the SVG text fallback.

Headlines keep their natural font proportions. The tall poster style applies
a consistent horizontal compression of 0.72 to Anton. Missing characters use
escaped system-font SVG text, so non-Latin titles remain visible.
