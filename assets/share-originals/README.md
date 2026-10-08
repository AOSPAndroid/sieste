# Approved retro sharing artwork

These three 1280 × 1280 RGBA PNGs are the original Sieste retro sharing drafts
created on 2026-10-08 with the built-in `image_gen` tool. They were copied byte
for byte from `output/share-drafts/retro-serif-20261008`. The accompanying
`prompts.json` is the original generation record. Its sample readings are
illustrative; the app uses readings from the selected activity or recovery data.

The reference direction was the supplied café-sign photograph: heavy rounded
1970s serif lettering, a slight rightward lean, tight counters, and a crisp
colored extrusion down and right. Running uses yellow/vermilion, cycling uses
ivory/indigo, and recovery uses glossy ice blue/cobalt. This directory is an
authoring source and is not imported by the production app.

To reproduce the application atlas with the existing `sharp` dependency:

```powershell
node scripts/extract-original-share-art.mjs
```

The script writes `app/original-share-art.json` and inspection images plus
metadata in `output/share-drafts/exact-art`. Use `--analyze` to report connected
front components and draw labeled bounds without regenerating the atlas.

Faces come from 8-connected front-color pixels. A nearest-face field projected
along the original down-right extrusion assigns their painted rear surface and
keyline without collecting adjacent letters. Original whole-reading groups,
icons, and signatures preserve the source composition. Individual dynamic
glyphs retain the original face and visible shadow, and fill shadow areas hidden
behind adjacent source glyphs using a down-right extrusion normalized to 8.5%
of the front height, so small source letters can scale to hero size. Missing native
characters come from another one of these original PNGs with target hue applied
while retaining luminance and texture. The absent digit `9` uses the rotated
original `6` face with a down-right rear surface. These cases are recorded in
each atlas item.

The bundled full images use adaptive indexed PNG encoding at quality 80 with a
target of 64 colors, no dithering, and no downsampling, to keep the optional
sharing module smaller. White face masks are
lossless. `originalBBox` uses absolute source-canvas coordinates; `frontBBox`
uses coordinates relative to the cropped item. Widths and heights remain source
pixels, and every image value is a complete data URI.
