import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

/**
 * Builds the app icons from the wordmark's symbol.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ICON IS NOT TRANSPARENT
 *
 * public/contango-mark.png is white ink on transparency, which is right for
 * the header and wrong for a tab: browsers draw favicons against their own
 * chrome, and on a light theme a white mark on transparency is an empty
 * square. So every icon here is composited onto the page's own background.
 * That also gives iOS something to round off instead of matting to black.
 * ---------------------------------------------------------------------------
 *
 * Run: node scripts/build-icons.mjs
 */
const SOURCE = 'public/contango-mark.png'
const GROUND = { r: 0x03, g: 0x03, b: 0x05, alpha: 1 }

/**
 * Share of the square the mark occupies.
 *
 * Small sizes get more of it: at 16px the usual generous padding leaves the
 * arms about a pixel wide and the shape stops reading.
 */
const inset = (size) => (size <= 32 ? 0.86 : 0.72)

/** Square icon at one size, as PNG bytes. */
async function icon(size) {
  const box = Math.round(size * inset(size))
  const mark = await sharp(SOURCE)
    .resize({ width: box, height: box, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  return sharp({ create: { width: size, height: size, channels: 4, background: GROUND } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * An ICO wrapping PNGs.
 *
 * The format allows a PNG payload per entry rather than a bitmap, which every
 * browser that still asks for favicon.ico understands, and it keeps the
 * transparency-free 32-bit path simple.
 */
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length

  entries.forEach(({ size, data }, i) => {
    const at = i * 16
    // 256 is stored as 0; nothing here is that big, but the rule is the rule.
    directory.writeUInt8(size >= 256 ? 0 : size, at)
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1)
    directory.writeUInt8(0, at + 2) // palette size — none
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...entries.map((e) => e.data)])
}

const icoSizes = [16, 32, 48]
const entries = []
for (const size of icoSizes) entries.push({ size, data: await icon(size) })

await writeFile('app/favicon.ico', ico(entries))
console.log(`app/favicon.ico — ${icoSizes.join(', ')} px`)

await writeFile('app/icon.png', await icon(512))
console.log('app/icon.png — 512 px')

await writeFile('app/apple-icon.png', await icon(180))
console.log('app/apple-icon.png — 180 px')
