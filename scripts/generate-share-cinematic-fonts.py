"""Generate on-demand cinematic share lettering; requires fontTools.

Source fonts, weights, licenses, and upstream URLs are documented in
assets/share-fonts/CINEMATIC-TYPE.md. Each face is a separate vector asset.
"""
import gzip
import json
import subprocess
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
characters = sorted(set(chr(i) for i in range(32, 256)) | set("ŒœŸẞ–—’‘×−"))
faces = [
    ("oswald", "Oswald-Variable.ttf", {"wght": 600}),
    ("action", "BarlowCondensed-SemiBoldItalic.ttf", {}),
    ("poster", "Teko-Variable.ttf", {"wght": 600}),
    ("widescreen", "Syncopate-Bold.ttf", {}),
    ("cinema", "BodoniModa-Variable.ttf", {"wght": 600, "opsz": 32}),
    ("modern", "SpaceGrotesk-Variable.ttf", {"wght": 700}),
]
directory = root / "public/share-assets/fonts"
directory.mkdir(parents=True, exist_ok=True)


def compact_number(value):
    """Retain 1/1000 font-unit precision without verbose variation floats."""
    rounded = round(float(value), 3)
    return str(int(rounded)) if rounded.is_integer() else str(rounded)


for key, filename, axes in faces:
    font = TTFont(root / "assets/share-fonts" / filename)
    if axes:
        font = instantiateVariableFont(font, axes, inplace=True)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    output = {}
    for character in characters:
        name = cmap.get(ord(character))
        if not name:
            continue
        pen = SVGPathPen(glyphs, ntos=compact_number)
        glyphs[name].draw(pen)
        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        output[character] = [
            font["hmtx"][name][0],
            *(round(value, 3) for value in (bounds.bounds or (0, 0, 0, 0))),
            pen.getCommands(),
        ]
    for character in "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:/.%−·":
        if character not in output:
            raise ValueError(f"{key} is missing required share glyph {character!r}")
    face = {"units": font["head"].unitsPerEm, "glyphs": output}
    data = (json.dumps(face, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    target = directory / f"reference-{key}.json"
    target.write_bytes(data)
    print(f"Generated {target.name}: {len(output)} glyphs, {len(data)} bytes, {len(gzip.compress(data))} gzip bytes")
    font.close()

subprocess.run(
    ["node", str(root / "scripts/package-share-assets.mjs"), "--index"],
    check=True,
    cwd=root,
)
