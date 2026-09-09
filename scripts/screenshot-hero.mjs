import { chromium } from 'playwright'

const OUT = '.shots'
const errors = []

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto('http://localhost:3111/', { waitUntil: 'networkidle' })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(3500) // let the canvas fade in and the scene settle

const probe = async () =>
  page.evaluate(() => {
    const wrapper = document.querySelector('[data-hero-pin]')
    const r = wrapper.getBoundingClientRect()
    const travel = r.height - window.innerHeight
    const p = travel <= 0 ? 0 : Math.max(0, Math.min(1, -r.top / travel))
    const c = document.querySelector('canvas')
    const h1 = document.querySelector('h1')
    const stateB = document.querySelectorAll('[style*="opacity"]')
    return {
      p: +p.toFixed(3),
      scrollY: Math.round(window.scrollY),
      canvas: c ? `${c.width}x${c.height}` : 'none',
      h1Opacity: getComputedStyle(h1.parentElement).opacity,
      stateBOpacity: getComputedStyle(document.querySelectorAll('h1')[0].parentElement.nextElementSibling).opacity,
      sphereHint: c ? c.getBoundingClientRect().width : 0,
      _b: stateB.length,
    }
  })

const steps = [
  { name: '00-state-a', target: 0 },
  { name: '01-approach', target: 0.28 },
  { name: '02a-pre', target: 0.44 },
  { name: '02-passthrough', target: 0.5 },
  { name: '02b-post', target: 0.55 },
  { name: '03-inside', target: 0.7 },
]

for (const s of steps) {
  const y = await page.evaluate((t) => {
    const wrapper = document.querySelector('[data-hero-pin]')
    const travel = wrapper.getBoundingClientRect().height - window.innerHeight
    return Math.round(wrapper.offsetTop + travel * t)
  }, s.target)

  await page.evaluate((y) => window.scrollTo(0, y), y)
  await page.waitForTimeout(2000) // let the damped p catch up

  const info = await probe()
  console.log(s.name.padEnd(16), JSON.stringify(info))
  await page.screenshot({ path: `${OUT}/${s.name}.png` })
}

console.log('\n=== ERRORS (' + errors.length + ') ===')
for (const e of errors.slice(0, 15)) console.log(e)

await browser.close()
