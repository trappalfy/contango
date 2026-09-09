import { chromium } from 'playwright'
import fs from 'node:fs/promises'

/**
 * Frame-by-frame capture of the welcome film — §9 of the video spec.
 *
 * The spec's listing is puppeteer; this is the same procedure on playwright,
 * which the project already carries and whose browser is already downloaded.
 * The three differences are the import, `newPage({ viewport })` instead of
 * `setViewport`, and `waitUntil: 'networkidle'`.
 *
 * Capture steps rather than plays: the page renders exactly the frame it is
 * asked for, so nothing is dropped and the result does not depend on how busy
 * the machine is.
 *
 * Run: node scripts/capture.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3111'
const OUT = 'frames'

const browser = await chromium.launch({
  args: [
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    // Headless Chromium has no GPU here; SwiftShader gives it a real WebGL
    // implementation instead of failing the context outright.
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
})

const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
})

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(m.text())
})
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message))

await page.goto(`${BASE}/render?capture=1`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

// The stage registers its hooks from an effect; if WebGL failed it never does,
// and waiting here turns that into a loud failure rather than 360 blank PNGs.
await page.waitForFunction(() => typeof window.__renderFrame === 'function', { timeout: 30000 })

const total = await page.evaluate(() => window.__totalFrames)
if (!Number.isInteger(total) || total < 1) throw new Error(`bad __totalFrames: ${total}`)

await fs.rm(OUT, { recursive: true, force: true })
await fs.mkdir(OUT, { recursive: true })

console.log(`capturing ${total} frames at 1920x1080 from ${BASE}/render`)
const started = Date.now()

for (let i = 0; i < total; i++) {
  await page.evaluate((n) => window.__renderFrame(n), i)
  await page.screenshot({
    path: `${OUT}/${String(i).padStart(4, '0')}.png`,
    omitBackground: false,
  })

  if ((i + 1) % 30 === 0 || i === total - 1) {
    const seconds = (Date.now() - started) / 1000
    console.log(`  ${i + 1}/${total}  ${seconds.toFixed(1)}s`)
  }
}

await browser.close()

const written = (await fs.readdir(OUT)).filter((f) => f.endsWith('.png'))
console.log(`\nwrote ${written.length} frames to ${OUT}/`)
if (written.length !== total) throw new Error(`expected ${total} frames, found ${written.length}`)

console.log(`console errors during capture: ${problems.length}`)
problems.slice(0, 5).forEach((p) => console.log('  ' + p))
