"""Regenerate reference sticker glyphs; requires fontTools.

Source fonts and licenses are documented in assets/share-fonts/REFERENCE-TYPE.md.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parent.parent
characters = sorted(set(chr(i) for i in range(32, 256)) | set("ŒœŸẞ–—’‘×−"))
faces = {}
for key, filename in [("wide", "ArchivoBlack-Regular.ttf"), ("hand", "Kalam-Light.ttf")]:
    font = TTFont(root / "assets/share-fonts" / filename)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    output = {}
    for character in characters:
        name = cmap.get(ord(character))
        if not name:
            continue
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        output[character] = [font["hmtx"][name][0], *(bounds.bounds or (0, 0, 0, 0)), pen.getCommands()]
    faces[key] = {"units": font["head"].unitsPerEm, "glyphs": output}

target = root / "app/share-reference-glyphs.json"
target.write_text(json.dumps(faces, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Generated {target.name}: {sum(len(face['glyphs']) for face in faces.values())} glyphs, {target.stat().st_size} bytes")
