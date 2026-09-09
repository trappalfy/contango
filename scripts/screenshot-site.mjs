import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3111'
const OUT = '.shots/site'
const errors = []

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})

const routes = [
  { path: '/', name: 'landing', scrollTo: 'section#spread', fullPage: false },
  { path: '/spread', name: 'spread', fullPage: true },
  { path: '/decay', name: 'decay', fullPage: true },
  { path: '/portfolio', name: 'portfolio', fullPage: true },
  { path: '/docs', name: 'docs', fullPage: true },
]

for (const route of routes) {
  // A fresh context per route: the hero keeps a WebGL context and an rAF loop
  // alive, and under software rendering that makes navigating away from it
  // slow enough to trip Playwright's default timeout.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE ${route.path}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${route.path}: ${e.message}`))

  const response = await page.goto(`${BASE}${route.path}`, { waitUntil: 'commit', timeout: 30000 })
  await page.waitForTimeout(route.path === '/' ? 4000 : 2500)

  if (route.scrollTo) {
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), route.scrollTo)
    await page.waitForTimeout(1500)
  }

  const probe = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      xom: text.includes('XOM'),
      uso: text.includes('USO'),
      price: /\$\d/.test(text),
      feedDown: text.includes('not answering'),
      chars: text.length,
    }
  })

  console.log(`${route.name.padEnd(10)} HTTP ${response?.status()}  ${JSON.stringify(probe)}`)
  await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: route.fullPage })
  await page.close()
}

// How long a real in-app navigation away from the hero actually takes.
const nav = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await nav.goto(`${BASE}/`, { waitUntil: 'commit' })
await nav.waitForTimeout(4000)
const started = Date.now()
await nav.click('header nav a[href="/spread"]')
await nav.waitForSelector('h1', { timeout: 30000 })
console.log(`\nclient nav hero -> /spread: ${Date.now() - started}ms (software renderer)`)
await nav.close()

console.log(`\n=== ERRORS (${errors.length}) ===`)
for (const e of errors.slice(0, 12)) console.log(e)

await browser.close()
