import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:3111/', { waitUntil: 'networkidle' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2500)

const result = await page.evaluate(() => {
  const wrapper = document.querySelector('[data-hero-pin]')
  const N = 2000

  // A: what the hook does now — write scroll, then read layout. The write
  // invalidates layout, so the read has to synchronously recompute it.
  let t0 = performance.now()
  for (let i = 0; i < N; i++) {
    window.scrollTo(0, 300 + (i % 40))
    const r = wrapper.getBoundingClientRect()
    if (r.top === 12345678) console.log('never')
  }
  const dirtyRead = performance.now() - t0

  // B: read layout without a preceding scroll write.
  window.scrollTo(0, 300)
  t0 = performance.now()
  for (let i = 0; i < N; i++) {
    const r = wrapper.getBoundingClientRect()
    if (r.top === 12345678) console.log('never')
  }
  const cleanRead = performance.now() - t0

  // C: the alternative — cached offsets plus scrollY, no rect read at all.
  const top = wrapper.offsetTop
  const height = wrapper.offsetHeight
  t0 = performance.now()
  let acc = 0
  for (let i = 0; i < N; i++) {
    window.scrollTo(0, 300 + (i % 40))
    acc += (window.scrollY - top) / (height - window.innerHeight)
  }
  const cached = performance.now() - t0

  return {
    dirtyReadPerCall: dirtyRead / N,
    cleanReadPerCall: cleanRead / N,
    cachedPerCall: cached / N,
    acc,
  }
})

console.log(`A. scrollTo + getBoundingClientRect : ${result.dirtyReadPerCall.toFixed(4)} ms/frame`)
console.log(`B. getBoundingClientRect alone      : ${result.cleanReadPerCall.toFixed(4)} ms/frame`)
console.log(`C. scrollTo + cached offsets        : ${result.cachedPerCall.toFixed(4)} ms/frame`)
console.log(`\nforced-layout penalty A - B = ${(result.dirtyReadPerCall - result.cleanReadPerCall).toFixed(4)} ms/frame`)

await browser.close()
