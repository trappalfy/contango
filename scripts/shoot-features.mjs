import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3111'
const OUT = '.shots/site'
const errors = []

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})

const newPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text())
  })
  return page
}

/* ---------------- chart ---------------- */
{
  const page = await newPage()
  await page.goto(`${BASE}/spread`, { waitUntil: 'commit' })
  await page.waitForSelector('svg[role="img"]', { timeout: 25000 })
  await page.waitForTimeout(1500)

  const info = await page.evaluate(() => {
    const svg = document.querySelector('svg[role="img"]')
    return {
      label: svg?.getAttribute('aria-label'),
      paths: svg?.querySelectorAll('path').length,
      bandRect: svg?.querySelectorAll('rect').length,
      gridLines: svg?.querySelectorAll('line').length,
    }
  })
  console.log('chart:', JSON.stringify(info))

  await page.evaluate(() => document.querySelector('svg[role="img"]')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(500)

  // Hover the middle of the plot to prove the crosshair works.
  const box = await page.locator('svg[role="img"]').boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2)
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${OUT}/chart.png`, clip: box ? { x: box.x - 40, y: box.y - 190, width: box.width + 80, height: box.height + 330 } : undefined })

  // Table view must carry the same data.
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.waitForTimeout(600)
  const rows = await page.evaluate(() => document.querySelectorAll('table tbody tr').length)
  console.log('table rows:', rows)
  await page.close()
}

/* ---------------- transaction lifecycle ---------------- */
{
  const page = await newPage()
  await page.goto(`${BASE}/spread`, { waitUntil: 'commit' })
  await page.waitForSelector('input[aria-label^="Amount of"]', { timeout: 25000 })
  await page.waitForTimeout(1200)

  await page.locator('input[aria-label^="Amount of"]').fill('10')
  await page.waitForTimeout(3200)

  const before = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Routing not connected/i.test(x.textContent))
    return b ? { label: b.textContent.trim(), disabled: b.disabled } : null
  })
  console.log('action button:', JSON.stringify(before))

  if (before && !before.disabled) {
    await page.getByRole('button', { name: /Routing not connected/i }).click()
    await page.waitForTimeout(900)
  }

  const status = await page.evaluate(() => {
    const el = document.querySelector('[role="status"][aria-live="polite"]')
    return el ? el.innerText.replace(/\n+/g, ' | ') : null
  })
  console.log('tx status panel:', JSON.stringify(status))

  const form = await page.locator('input[aria-label^="Amount of"]').boundingBox()
  await page.screenshot({
    path: `${OUT}/tx-status.png`,
    clip: form ? { x: form.x - 40, y: form.y - 120, width: 500, height: 780 } : undefined,
  })
  await page.close()
}

/* ---------------- portfolio ---------------- */
{
  const page = await newPage()
  await page.goto(`${BASE}/portfolio`, { waitUntil: 'commit' })
  await page.waitForTimeout(3000)
  const text = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '))
  console.log('portfolio:', JSON.stringify(text))
  await page.screenshot({ path: `${OUT}/portfolio.png`, fullPage: true })
  await page.close()
}

console.log(`\n=== ERRORS (${errors.length}) ===`)
errors.slice(0, 10).forEach((e) => console.log(e))
await browser.close()
