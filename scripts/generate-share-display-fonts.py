"""Regenerate SVG display glyphs: python scripts/generate-share-display-fonts.py.

Requires fontTools. Source fonts and licenses are in assets/share-fonts.
Glyph paths make browser PNG rendering independent of installed/exported fonts.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parent.parent
characters = sorted(set(chr(i) for i in range(32, 256)) | set("ŒœŸẞ–—’‘×−"))
faces = {}
for key, filename in [("bold", "Anton-Regular.ttf"), ("tall", "BebasNeue-Regular.ttf"), ("serif", "DMSerifDisplay-Regular.ttf"), ("wide", "RussoOne-Regular.ttf"), ("slab", "RobotoSlab-Black.ttf"), ("retro", "Shrikhand-Regular.ttf")]:
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

target = root / "app/share-display-glyphs.json"
target.write_text(json.dumps(faces, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Generated {target.name}: {sum(len(face['glyphs']) for face in faces.values())} glyphs, {target.stat().st_size} bytes")
