# Share display lettering

Anton (Vernon Adams), Bebas Neue (Ryoichi Tsunekawa) and DM Serif Display
(Colophon Foundry) are redistributed under their included SIL Open Font Licenses.
Sources: the respective `ofl/anton`, `ofl/bebasneue` and `ofl/dmserifdisplay`
directories in https://github.com/google/fonts.

The original font files are build-time source assets. They are not downloaded by
the browser. `scripts/generate-share-display-fonts.py` uses fontTools to generate
the Latin glyph outlines in `app/share-display-glyphs.json`, including French
accented lettering. These render as SVG paths for identical preview and PNG
headline typography across devices. Unsupported characters fall back to escaped
SVG text rather than being omitted.
