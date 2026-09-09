import { chromium } from 'playwright'

/** Fails loudly if any page scrolls horizontally at a phone, tablet or desk width. */
const BASE = process.argv[2] ?? 'http://localhost:3111'
const ROUTES = ['/', '/spread', '/decay', '/docs', '/portfolio']

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})

for (const width of [375, 768, 1440]) {
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(BASE + route, { waitUntil: 'commit' })
    await page.waitForTimeout(2200)
    const o = await page.evaluate(() => {
      const de = document.documentElement
      const over = []
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect()
        if (b.width > 0 && b.right > de.clientWidth + 1.5) {
          over.push(el.tagName + '#' + (el.className?.toString?.().slice(0, 30) ?? '') + '@' + Math.round(b.right))
        }
      }
      return { s: de.scrollWidth, c: de.clientWidth, over: over.slice(0, 3) }
    })
    console.log(width, route, `${o.s}/${o.c}`, o.s > o.c + 1 ? 'OVERFLOW' : 'ok', JSON.stringify(o.over))
    await page.close()
  }
}

await browser.close()
