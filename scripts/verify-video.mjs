import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { ringsDeparted, ROLLS, TOTAL_FRAMES, stateAt } from '../lib/welcome/timeline.ts'

/**
 * The §11 acceptance list, run against the captured frames.
 *
 * Only the checkable items. "No call to action", "reads as ours" and the like
 * are for a person; everything below is arithmetic on pixels.
 *
 * Run: node --experimental-strip-types scripts/verify-video.mjs
 */
const DIR = 'frames'
const frame = (i) => `${DIR}/${String(i).padStart(4, '0')}.png`

/** The one accent in the film — the rule under the numeral in beat 5. */
const ACCENT = [0x3f, 0x47, 0xff]

async function stats(path, region) {
  const img = sharp(path)
  const { data, info } = await (region ? img.extract(region) : img)
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sum = 0
  let accent = 0
  const c = info.channels

  for (let i = 0; i < data.length; i += c) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    // Generous, because the frame is JPEG-free but still resampled by bloom.
    if (
      Math.abs(data[i] - ACCENT[0]) < 26 &&
      Math.abs(data[i + 1] - ACCENT[1]) < 26 &&
      Math.abs(data[i + 2] - ACCENT[2]) < 26
    ) {
      accent++
    }
  }

  return { mean: sum / (data.length / c), accent }
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.png'))
console.log(`frames on disk: ${files.length} (expected ${TOTAL_FRAMES}) — ${files.length === TOTAL_FRAMES ? 'ok' : 'MISMATCH'}`)

console.log(`rings departed by frame 200: ${ringsDeparted(200)} (must be ${ROLLS}) — ${ringsDeparted(200) === ROLLS ? 'ok' : 'FAIL'}`)
console.log(`rings departed by frame 199: ${ringsDeparted(199)}, by 184: ${ringsDeparted(184)}`)

// The loop seam: both ends must be black, or the repeat jumps.
const first = await stats(frame(0))
const last = await stats(frame(TOTAL_FRAMES - 1))
console.log(`loop seam — frame 0 mean ${first.mean.toFixed(2)}, frame 359 mean ${last.mean.toFixed(2)} — ${first.mean < 1 && last.mean < 1 ? 'ok' : 'FAIL'}`)

// The accent may appear in beat 5 and nowhere else.
const beat5 = []
const elsewhere = []
for (let i = 0; i < TOTAL_FRAMES; i += 4) {
  const s = await stats(frame(i))
  if (s.accent > 0) (stateAt(i).beat === 5 ? beat5 : elsewhere).push(i)
}
console.log(`accent #3F47FF — sampled frames carrying it: beat 5 ${beat5.length}, elsewhere ${elsewhere.length} ${elsewhere.length ? '(' + elsewhere.slice(0, 8).join(',') + ') FAIL' : '— ok'}`)

/**
 * The left sphere gains nothing.
 *
 * Measured across beat 3, where the camera is still and the twelve rings leave
 * the right-hand sphere: the right third must lose brightness and the left
 * third must not move beyond what its own slow rotation accounts for.
 */
const band = { left: 0, top: 140, width: 620, height: 800 }
const rightBand = { ...band, left: 1300 }

const l1 = await stats(frame(130), band)
const l2 = await stats(frame(184), band)
const r1 = await stats(frame(130), rightBand)
const r2 = await stats(frame(184), rightBand)

const pct = (a, b) => (((b - a) / a) * 100).toFixed(1)
console.log(`left sphere across beat 3:  ${l1.mean.toFixed(2)} -> ${l2.mean.toFixed(2)}  (${pct(l1.mean, l2.mean)}%)`)
console.log(`right sphere across beat 3: ${r1.mean.toFixed(2)} -> ${r2.mean.toFixed(2)}  (${pct(r1.mean, r2.mean)}%)`)
