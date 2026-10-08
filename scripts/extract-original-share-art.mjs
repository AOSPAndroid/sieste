import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "assets/share-originals");
const outputDir = path.join(root, "output/share-drafts/exact-art");
// Indexed PNG keeps the lazy artwork module small. Geometry and native alpha
// masks stay source-derived. Quality 80 allows an adaptive compact palette;
// colours alone maps to PNG bit depth in sharp and can retain 256 entries.
const pngOptions = { compressionLevel: 9, palette: true, colours: 64, quality: 80, dither: 0, effort: 10 };

function isFront(kind, r, g, b, a) {
  if (a < 100) return false;
  if (kind === "running") return r > 180 && g > 110 && b < 110;
  if (kind === "cycling") return r > 180 && g > 180 && b > 110;
  return g > 100 && r > 40;
}

function components(pixels, width, height, kind) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const found = [];
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] || !isFront(kind, ...pixels.subarray(index * 4, index * 4 + 4))) continue;
    const label = found.length + 1;
    let head = 0, tail = 1;
    queue[0] = index;
    labels[index] = label;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    while (head < tail) {
      const point = queue[head++];
      const x = point % width, y = Math.floor(point / width);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const next = yy * width + xx;
        if (!labels[next] && isFront(kind, ...pixels.subarray(next * 4, next * 4 + 4))) {
          labels[next] = label;
          queue[tail++] = next;
        }
      }
    }
    found.push({ id: label, area: tail, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] });
  }
  return { labels, found };
}

await fs.mkdir(outputDir, { recursive: true });
const sources = {};
for (const kind of ["running", "cycling", "recovery"]) {
  const { data, info } = await sharp(path.join(sourceDir, `${kind}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { labels, found } = components(data, info.width, info.height, kind);
  sources[kind] = { data, labels, found, width: info.width, height: info.height };
  const visible = found.filter(component => component.area >= 80);
  console.log(kind, JSON.stringify(visible));
  await fs.writeFile(path.join(outputDir, `${kind}-front-components.json`), JSON.stringify(visible, null, 2));
  const rects = visible.map(component => {
    const [x, y, w, h] = component.bbox;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#00ff88"/><text x="${x + 2}" y="${y + 15}" fill="#ffffff" font-size="16" font-family="Arial">${component.id}</text>`;
  }).join("");
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${rects}</svg>`);
  await sharp(data, { raw: info }).composite([{ input: overlay }]).png().toFile(path.join(outputDir, `${kind}-front-components.png`));
}

if (process.argv.includes("--analyze")) process.exit(0);

// Assign the original outline/extrusion to its front component. The rearward
// search follows the artwork's down-right extrusion. Pixels owned by adjacent
// faces never enter an individual glyph, even when their shadows touch.
function ownership(source) {
  const { width, height, labels, found, data } = source;
  const count = width * height;
  const valid = new Set(found.filter(c => c.area >= 80).map(c => c.id));
  const nearest = new Int32Array(count);
  const distance = new Float32Array(count).fill(1e6);
  for (let i = 0; i < count; i++) if (valid.has(labels[i])) { nearest[i] = labels[i]; distance[i] = 0; }
  const relax = (i, next, cost) => {
    if (distance[next] + cost < distance[i]) { distance[i] = distance[next] + cost; nearest[i] = nearest[next]; }
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) relax(i, i - 1, 1);
    if (y) relax(i, i - width, 1);
    if (x && y) relax(i, i - width - 1, Math.SQRT2);
    if (x + 1 < width && y) relax(i, i - width + 1, Math.SQRT2);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) relax(i, i + 1, 1);
    if (y + 1 < height) relax(i, i + width, 1);
    if (x + 1 < width && y + 1 < height) relax(i, i + width + 1, Math.SQRT2);
    if (x && y + 1 < height) relax(i, i + width - 1, Math.SQRT2);
  }
  const owners = new Int32Array(count);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (data[i * 4 + 3] < 10) continue;
    if (valid.has(labels[i])) { owners[i] = labels[i]; continue; }
    // The narrow colored keyline belongs to the nearest face, even when a
    // neighboring face projects a shadow through it.
    if (distance[i] <= 3.5) { owners[i] = nearest[i]; continue; }
    let best = 10.5, owner = 0;
    for (let back = 0; back <= 40; back++) {
      const xx = x - back, yy = y - back;
      if (xx < 0 || yy < 0) break;
      const j = yy * width + xx;
      const score = distance[j] + back * .035;
      if (score < best) { best = score; owner = nearest[j]; }
    }
    owners[i] = owner;
  }
  return owners;
}
for (const source of Object.values(sources)) source.owners = ownership(source);

const atlas = {
  version: 1,
  sourceCanvas: [1280, 1280],
  sources: Object.fromEntries(["running", "cycling", "recovery"].map(kind => [kind, `assets/share-originals/${kind}.png`])),
  extraction: "Original PNG faces are 8-connected color components; outlines and down-right extrusions belong to the nearest projected front. Original face geometry and texture retained, adaptive indexed PNG encoding at quality80/target64colors with no dithering or downsampling; masks keep source alpha. Missing native glyphs use another original card with its face/shadow recolored; 9 rotates the original 6 face by 180 degrees and retains a down-right extrusion. Dynamic glyph rear depth is normalized to 8.5% of front height.",
  glyphs: { running: {}, cycling: {}, recovery: {} },
  icons: { running: {}, cycling: {}, recovery: {} },
  groups: { running: {}, cycling: {}, recovery: {} },
};
const sourceCache = new Map();
async function extract(kind, ids, name) {
  const cacheKey = `${kind}:${ids.join(",")}`;
  if (sourceCache.has(cacheKey)) return sourceCache.get(cacheKey);
  const source = sources[kind];
  const selected = new Set(ids);
  let x0 = source.width, y0 = source.height, x1 = -1, y1 = -1;
  let fx0 = source.width, fy0 = source.height, fx1 = -1, fy1 = -1;
  for (let i = 0; i < source.owners.length; i++) if (selected.has(source.owners[i])) {
    const x = i % source.width, y = Math.floor(i / source.width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (isFront(kind, ...source.data.subarray(i * 4, i * 4 + 4))) {
      fx0 = Math.min(fx0, x); fy0 = Math.min(fy0, y); fx1 = Math.max(fx1, x); fy1 = Math.max(fy1, y);
    }
  }
  if (x1 < x0) throw new Error(`Empty source asset ${kind}:${name}`);
  const width = x1 - x0 + 1, height = y1 - y0 + 1;
  const pixels = Buffer.alloc(width * height * 4);
  const face = Buffer.alloc(width * height * 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * source.width + x;
    if (!selected.has(source.owners[i])) continue;
    const j = ((y - y0) * width + x - x0) * 4;
    source.data.copy(pixels, j, i * 4, i * 4 + 4);
    if (isFront(kind, ...source.data.subarray(i * 4, i * 4 + 4))) {
      face[j] = face[j + 1] = face[j + 2] = 255;
      face[j + 3] = source.data[i * 4 + 3];
    }
  }
  const opts = { raw: { width, height, channels: 4 } };
  const png = await sharp(pixels, opts).png(pngOptions).toBuffer();
  const facePng = await sharp(face, opts).png({ compressionLevel: 9 }).toBuffer();
  const item = { png: `data:image/png;base64,${png.toString("base64")}`, faceMask: `data:image/png;base64,${facePng.toString("base64")}`, width, height, originalBBox: [x0, y0, width, height], frontBBox: [fx0 - x0, fy0 - y0, fx1 - fx0 + 1, fy1 - fy0 + 1], advance: fx1 - fx0 + 1, source: { kind, components: ids } };
  await fs.writeFile(path.join(outputDir, `${kind}-${name}.png`), png);
  sourceCache.set(cacheKey, item);
  return item;
}
const originalGlyphs = {
  running: { "0": [5], "1": [8], "5": [14], "6": [20], ":": [22, 25], "/": [13], ".": [11] },
  cycling: { "2": [12], "3": [2], "5": [5], "7": [3], "h": [11], "k": [7], "m": [9], "/": [16], ".": [6] },
  recovery: { "0": [58], "1": [54], "4": [190], "5": [206], "8": [36], "h": [39], "m": [251], "s": [249], "/": [210] },
};
const bestOriginal = { "0": ["running", [5]], "1": ["running", [8]], "2": ["cycling", [12]], "3": ["cycling", [2]], "4": ["recovery", [190]], "5": ["cycling", [5]], "6": ["running", [20]], "7": ["cycling", [3]], "8": ["recovery", [36]], "h": ["recovery", [39]], "k": ["cycling", [7]], "m": ["cycling", [9]], "s": ["recovery", [249]], ":": ["running", [22, 25]], "/": ["recovery", [210]], ".": ["running", [11]] };
const palettes = { running: { face: [255, 215, 0], shadow: [219, 4, 0] }, cycling: { face: [255, 248, 218], shadow: [12, 2, 131] }, recovery: { face: [146, 224, 255], shadow: [0, 32, 225] } };
async function recolor(item, kind) {
  const bytes = Buffer.from(item.png.split(",")[1], "base64");
  const maskBytes = Buffer.from(item.faceMask.split(",")[1], "base64");
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = await sharp(maskBytes).ensureAlpha().raw().toBuffer();
  const { face, shadow } = palettes[kind];
  const native = palettes[item.source.kind];
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const isFace = mask[i + 3] > 0;
    const from = isFace ? native.face : native.shadow;
    const to = isFace ? face : shadow;
    const luminance = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
    const reference = from[0] * .2126 + from[1] * .7152 + from[2] * .0722;
    const shade = Math.min(1.5, luminance / Math.max(1, reference));
    for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.max(0, Math.min(255, to[channel] * shade));
  }
  const png = await sharp(data, { raw: info }).png(pngOptions).toBuffer();
  return { ...item, png: `data:image/png;base64,${png.toString("base64")}`, synthesized: `Original ${item.source.kind} glyph recolored to ${kind}` };
}
async function isolateGlyph(item, targetKind = item.source.kind) {
  const original = await sharp(Buffer.from(item.png.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  const front = await sharp(Buffer.from(item.faceMask.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  // A small support numeral scaled to hero height must have the same relative
  // extrusion as a native hero numeral, rather than scaling its 25px rear.
  const depth = Math.max(2, Math.round(item.frontBBox[3] * .085));
  const [dx, dy] = [depth, depth];
  const width = item.width + 4, height = item.height + 4;
  const silhouette = new Uint8Array(width * height);
  const face = Buffer.alloc(width * height * 4);
  for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) {
    const j = (y * item.width + x) * 4;
    const alpha = front[j + 3];
    if (!alpha) continue;
    const k = (y * width + x) * 4;
    face[k] = face[k + 1] = face[k + 2] = 255; face[k + 3] = alpha;
    for (let step = 0; step <= Math.max(dx, dy); step++) {
      const xx = x + Math.round(step * dx / Math.max(dx, dy));
      const yy = y + Math.round(step * dy / Math.max(dx, dy));
      if (xx < width && yy < height) silhouette[yy * width + xx] = Math.max(silhouette[yy * width + xx], alpha);
      // Keep the original narrow outline around the front and extrusion.
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (xx + ox >= 0 && yy + oy >= 0 && xx + ox < width && yy + oy < height) silhouette[(yy + oy) * width + xx + ox] = Math.max(silhouette[(yy + oy) * width + xx + ox], alpha);
      }
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  const shadow = palettes[targetKind].shadow;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, j = i * 4;
    if (!silhouette[i]) continue;
    const old = (y * item.width + x) * 4;
    if (x < item.width && y < item.height && original[old + 3]) original.copy(pixels, j, old, old + 4);
    else { pixels[j] = shadow[0]; pixels[j + 1] = shadow[1]; pixels[j + 2] = shadow[2]; pixels[j + 3] = silhouette[i]; }
  }
  const options = { raw: { width, height, channels: 4 } };
  const png = await sharp(pixels, options).png(pngOptions).toBuffer();
  const facePng = await sharp(face, options).png({ compressionLevel: 9 }).toBuffer();
  return { ...item, png: `data:image/png;base64,${png.toString("base64")}`, faceMask: `data:image/png;base64,${facePng.toString("base64")}`, width, height, originalBBox: [item.originalBBox[0], item.originalBBox[1], width, height], extrusionDepth: depth, isolation: "Original face and visible outline/shadow; down-right extrusion fills occluded regions and is normalized to 8.5% of front height." };
}
for (const kind of ["running", "cycling", "recovery"]) {
  for (const char of "012345678hkms:/.") {
    let original = originalGlyphs[kind][char] ? [kind, originalGlyphs[kind][char]] : bestOriginal[char];
    // Prefer a large original face for hero-sized numbers where available.
    if (/^[0-8]$/.test(char) && originalGlyphs[kind][char]) {
      const nativeHeight = Math.max(...originalGlyphs[kind][char].map(id => sources[kind].found[id - 1].bbox[3]));
      const preferred = bestOriginal[char];
      const preferredHeight = Math.max(...preferred[1].map(id => sources[preferred[0]].found[id - 1].bbox[3]));
      if (preferredHeight > nativeHeight * 1.5) original = preferred;
    }
    const assetName = `glyph-${char === "/" ? "slash" : char === ":" ? "colon" : char === "." ? "dot" : char}`;
    let item = await isolateGlyph(await extract(original[0], original[1], assetName));
    if (original[0] !== kind) item = await recolor(item, kind);
    await fs.writeFile(path.join(outputDir, `${kind}-${assetName}.png`), Buffer.from(item.png.split(",")[1], "base64"));
    atlas.glyphs[kind][char] = item;
  }
  const six = atlas.glyphs[kind]["6"];
  const rotateUri = async uri => `data:image/png;base64,${(await sharp(Buffer.from(uri.split(",")[1], "base64")).rotate(180).png(pngOptions).toBuffer()).toString("base64")}`;
  const rotatedMaskPng = await sharp(Buffer.from(six.faceMask.split(",")[1], "base64")).rotate(180).png({ compressionLevel: 9 }).toBuffer();
  const rotatedMaskUri = `data:image/png;base64,${rotatedMaskPng.toString("base64")}`;
  const rotatedMask = await sharp(Buffer.from(rotatedMaskUri.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  const rotated = await sharp(Buffer.from(six.png.split(",")[1], "base64")).rotate(180).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < rotated.length; i += 4) if (!rotatedMask[i + 3]) rotated[i + 3] = 0;
  const rotatedPng = await sharp(rotated, { raw: { width: six.width, height: six.height, channels: 4 } }).png(pngOptions).toBuffer();
  const nine = { ...six, png: `data:image/png;base64,${rotatedPng.toString("base64")}`, faceMask: rotatedMaskUri, frontBBox: [six.width - six.frontBBox[0] - six.frontBBox[2], six.height - six.frontBBox[1] - six.frontBBox[3], six.frontBBox[2], six.frontBBox[3]], synthesized: "180-degree rotation of the original running 6 face; source has no 9. Rear shadow keeps the card's original down-right direction." };
  atlas.glyphs[kind]["9"] = await isolateGlyph(nine, kind);
  await fs.writeFile(path.join(outputDir, `${kind}-glyph-9.png`), Buffer.from(atlas.glyphs[kind]["9"].png.split(",")[1], "base64"));
}
const iconDefinitions = { running: { runner: [1, 3], signature: [27, 28, 29, 30, 31, 32, 33] }, cycling: { bicycle: [1], route: [8], signature: [20, 21, 22, 23, 24, 25, 26] }, recovery: { moon: [2], pulse: [147], star: [148], dot: [296], signature: [315, 317, 334, 335, 336, 337, 338], signalLeft: [286, 287, 296, 297, 299, 301, 306], signalRight: [285, 290, 291, 302, 303, 305, 309] } };
for (const [kind, definitions] of Object.entries(iconDefinitions)) for (const [name, ids] of Object.entries(definitions)) atlas.icons[kind][name] = await extract(kind, ids, `icon-${name}`);
// The chart's painted dot touches a connector. Keep only its original round
// front and small down-right rear surface for reuse at live chart samples.
{
  const item = atlas.icons.recovery.dot;
  const pixels = await sharp(Buffer.from(item.png.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  const front = await sharp(Buffer.from(item.faceMask.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  const [sx, sy, fw, fh] = sources.recovery.found[295].bbox;
  const fx = sx - item.originalBBox[0], fy = sy - item.originalBBox[1];
  const cx = fx + (fw - 1) / 2, cy = fy + (fh - 1) / 2, radius = Math.max(fw, fh) / 2 + 1.5;
  for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) {
    let inDot = false;
    for (let step = 0; step <= 5; step++) if (Math.hypot(x - cx - step * .8, y - cy - step) <= radius) inDot = true;
    if (!inDot) pixels[(y * item.width + x) * 4 + 3] = 0;
    if (Math.hypot(x - cx, y - cy) > Math.max(fw, fh) / 2 + .5) front[(y * item.width + x) * 4 + 3] = 0;
  }
  const png = await sharp(pixels, { raw: { width: item.width, height: item.height, channels: 4 } }).png(pngOptions).toBuffer();
  const facePng = await sharp(front, { raw: { width: item.width, height: item.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  atlas.icons.recovery.dot = { ...item, png: `data:image/png;base64,${png.toString("base64")}`, faceMask: `data:image/png;base64,${facePng.toString("base64")}`, frontBBox: [fx, fy, fw, fh], isolation: "Original glossy point clipped to its circular front and small down-right rear; connector removed." };
  await fs.writeFile(path.join(outputDir, "recovery-icon-dot.png"), png);
}
const groupDefinitions = {
  running: { "10.01": [5, 6, 7, 8, 11], "km": [10], "51:00": [14, 15, 16, 17, 22, 25], "5:06/km": [13, 18, 19, 20, 21, 23, 26] },
  cycling: { "77.53": [2, 3, 4, 5, 6], "km": [7, 9], "3h22": [10, 11, 12, 13], "23km/h": [14, 15, 16, 17, 18, 19] },
  recovery: { "8h01": [36, 39, 54, 58], "104ms": [181, 190, 194, 249, 251], "85/100": [185, 206, 210, 222, 224, 230] },
};
for (const [kind, definitions] of Object.entries(groupDefinitions)) for (const [name, ids] of Object.entries(definitions)) atlas.groups[kind][name] = await extract(kind, ids, `group-${name.replaceAll("/", "-").replaceAll(":", "-")}`);
await fs.writeFile(path.join(root, "app/original-share-art.json"), JSON.stringify(atlas));
await fs.writeFile(path.join(outputDir, "atlas-metadata.json"), JSON.stringify(atlas, (key, value) => key === "png" || key === "faceMask" ? undefined : value, 2));
console.log(`Wrote original-share-art.json (${(await fs.stat(path.join(root, "app/original-share-art.json"))).size} bytes)`);
