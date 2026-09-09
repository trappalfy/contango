import sharp from 'sharp'

/**
 * Turns the supplied artwork into a header-ready mark.
 *
 * The source is pure black on pure white with antialiased edges, so the
 * conversion is exact rather than a key: luminance becomes transparency and the
 * ink becomes white. Keeping the edge pixels is the point — a hard threshold
 * would leave the star jagged wherever it renders small.
 *
 * No resampling. The crop is emitted at source resolution, because downscaling
 * here spread faint ringing across the transparent field, which reads as a haze
 * box on a near-black page.
 *
 * Run: node scripts/build-logo.mjs [source] [destination]
 */
const SRC = process.argv[2] ?? 'contango-logo.png'
const OUT = process.argv[3] ?? 'public/contango-mark.png'
/** Ink coverage below this is edge antialiasing, not the body of a shape. */
const SOLID = 128
/** How far a shape's antialiased fringe reaches beyond its solid body. */
const FRINGE = 2

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true })
const { width: w, height: h, channels: c } = info

// Ink coverage, 0..255. The source has no alpha channel, so luminance is it.
const ink = new Uint8Array(w * h)
for (let p = 0; p < w * h; p++) {
  const i = p * c
  const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  ink[p] = Math.max(0, Math.min(255, Math.round(255 - lum)))
}

/**
 * Label solid pixels into connected shapes (4-connectivity, iterative flood so
 * a 1.5M-pixel image cannot blow the stack). The artwork holds two separate
 * shapes — the star and a small copyright glyph — and only the star is wanted.
 */
const label = new Int32Array(w * h).fill(-1)
const shapes = []
const stack = []

for (let seed = 0; seed < w * h; seed++) {
  if (ink[seed] < SOLID || label[seed] !== -1) continue

  const id = shapes.length
  const box = { id, x0: w, y0: h, x1: -1, y1: -1, count: 0 }
  label[seed] = id
  stack.push(seed)

  while (stack.length) {
    const p = stack.pop()
    const x = p % w
    const y = (p / w) | 0
    box.count++
    if (x < box.x0) box.x0 = x
    if (y < box.y0) box.y0 = y
    if (x > box.x1) box.x1 = x
    if (y > box.y1) box.y1 = y

    const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
    for (const n of neighbours) {
      if (n >= 0 && label[n] === -1 && ink[n] >= SOLID) {
        label[n] = id
        stack.push(n)
      }
    }
  }
  shapes.push(box)
}

shapes.sort((a, b) => b.count - a.count)
console.log(`shapes found: ${shapes.length}`)
for (const s of shapes) {
  console.log(`  #${s.id} ${s.count} px  box ${s.x0},${s.y0} -> ${s.x1},${s.y1}  (${s.x1 - s.x0 + 1}x${s.y1 - s.y0 + 1})`)
}

const mark = shapes[0]

/**
 * The mask of ink to keep: the star's solid body, grown by the fringe width.
 *
 * Growing it matters. A shape's antialiased edge never reaches the SOLID
 * threshold, so those pixels carry no label — filtering on the label alone left
 * the discarded copyright glyph behind as a faint white ring.
 */
let keep = new Uint8Array(w * h)
for (let p = 0; p < w * h; p++) if (label[p] === mark.id) keep[p] = 1

for (let round = 0; round < FRINGE; round++) {
  const grown = Uint8Array.from(keep)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (keep[p]) continue
      if (
        (x > 0 && keep[p - 1]) ||
        (x < w - 1 && keep[p + 1]) ||
        (y > 0 && keep[p - w]) ||
        (y < h - 1 && keep[p + w])
      ) {
        grown[p] = 1
      }
    }
  }
  keep = grown
}

// White ink throughout; transparency alone carries the shape.
const cropW = mark.x1 - mark.x0 + 1
const cropH = mark.y1 - mark.y0 + 1
const out = Buffer.alloc(cropW * cropH * 4)
let dropped = 0

for (let y = 0; y < cropH; y++) {
  for (let x = 0; x < cropW; x++) {
    const src = (y + mark.y0) * w + (x + mark.x0)
    const a = keep[src] ? ink[src] : 0
    if (!keep[src] && ink[src] > 0) dropped++
    const d = (y * cropW + x) * 4
    out[d] = 255
    out[d + 1] = 255
    out[d + 2] = 255
    out[d + 3] = a
  }
}

await sharp(out, { raw: { width: cropW, height: cropH, channels: 4 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile(OUT)

const written = await sharp(OUT).metadata()
console.log(`\ndropped ${dropped} px belonging to other shapes`)
console.log(`wrote ${OUT} - ${written.width}x${written.height}, alpha ${written.hasAlpha}`)
console.log(`cropped from ${w}x${h} to the mark's own bounds, at native resolution`)
