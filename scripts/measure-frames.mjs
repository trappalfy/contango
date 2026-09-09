import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:3111/'
const label = process.argv[3] ?? url

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('canvas')
await page.waitForTimeout(3000)

const deltas = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const out = []
      let last = performance.now()
      let n = 0
      const tick = (t) => {
        out.push(t - last)
        last = t
        // Feed Lenis real wheel input so the whole scroll path is exercised.
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 9, bubbles: true, cancelable: true }))
        if (++n < 420) requestAnimationFrame(tick)
        else resolve(out)
      }
      requestAnimationFrame(tick)
    }),
)

const body = deltas.slice(20) // drop warm-up
const sorted = [...body].sort((a, b) => a - b)
const q = (p) => sorted[Math.floor(sorted.length * p)]
const mean = body.reduce((a, b) => a + b, 0) / body.length

const long33 = body.filter((d) => d > 33).length
const long50 = body.filter((d) => d > 50).length
const long100 = body.filter((d) => d > 100).length

console.log(`--- ${label} ---`)
console.log(`frames=${body.length}  mean=${mean.toFixed(1)}ms  (~${(1000 / mean).toFixed(1)} fps)`)
console.log(`p50=${q(0.5).toFixed(1)}  p90=${q(0.9).toFixed(1)}  p95=${q(0.95).toFixed(1)}  p99=${q(0.99).toFixed(1)}  max=${sorted[sorted.length - 1].toFixed(1)}`)
console.log(`long frames: >33ms=${long33} (${((long33 / body.length) * 100).toFixed(1)}%)  >50ms=${long50}  >100ms=${long100}`)

// Jitter: how much consecutive frame times differ. Steady 30fps feels fine;
// alternating 8ms/60ms at the same average does not.
let jitter = 0
for (let i = 1; i < body.length; i++) jitter += Math.abs(body[i] - body[i - 1])
console.log(`mean abs frame-to-frame jitter = ${(jitter / (body.length - 1)).toFixed(1)}ms`)

await browser.close()
