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

Russo One (Jovanny Lemonad), from `ofl/russoone` in the official Google Fonts
repository, is redistributed under its included SIL Open Font License.
Roboto Slab, from `apache/robotoslab`, is redistributed under its included
Apache License 2.0. The supplied Slab Black is a static weight-900 instance
subset to the Latin range above with fontTools; its name and license records
are retained. These two faces also ship as self-contained vector glyphs.

Shrikhand (Jonny Pinhorn), from `ofl/shrikhand` in the official Google Fonts
repository, is redistributed under the included SIL Open Font License.
The retro share collection uses its Latin glyph outlines; neither the font nor
the reference drafts are fetched at export time.
