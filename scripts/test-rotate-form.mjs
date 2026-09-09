import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3111'
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text())
})

await page.goto(`${BASE}/spread`, { waitUntil: 'commit' })
await page.waitForSelector('input[aria-label^="Amount of"]', { timeout: 20000 })
await page.waitForTimeout(1500)

const summary = () =>
  page.evaluate(() => {
    const rows = {}
    document.querySelectorAll('div').forEach((el) => {
      const label = el.querySelector(':scope > span.font-mono.uppercase')
      const value = el.querySelector(':scope > span.font-mono:not(.uppercase)')
      if (label && value) rows[label.textContent.trim()] = value.textContent.trim()
    })
    const button = [...document.querySelectorAll('button')].find((b) =>
      /Enter an amount|Pricing|Routing not connected|Insufficient|Connect|No quote|Cannot price/i.test(
        b.textContent,
      ),
    )
    const out = [...document.querySelectorAll('div.font-mono')]
      .map((d) => d.textContent.trim())
      .filter((t) => /^[\d.,]+$/.test(t))
    return { rows, action: button?.textContent?.trim() ?? null, numericBlocks: out.slice(0, 4) }
  })

console.log('--- empty state ---')
console.log(JSON.stringify(await summary(), null, 1))

const input = page.locator('input[aria-label^="Amount of"]')
await input.click()
await input.type('10', { delay: 60 })
console.log('\ntyped "10", waiting for the debounced quote...')
await page.waitForTimeout(3500)

console.log('--- after quote ---')
console.log(JSON.stringify(await summary(), null, 1))

// Slippage must feed straight into min received.
await page.getByRole('button', { name: '1%', exact: true }).click()
await page.waitForTimeout(600)
const afterSlippage = await summary()
console.log('\nmin received at 1% slippage:', afterSlippage.rows['Min received (1%)'])

// Reversing must clear the amount and flip the legs.
await page.getByRole('button', { name: /Reverse/i }).click()
await page.waitForTimeout(1200)
const reversed = await page.evaluate(() => ({
  input: document.querySelector('input[aria-label^="Amount of"]')?.getAttribute('aria-label'),
  value: document.querySelector('input[aria-label^="Amount of"]')?.value,
}))
console.log('after reverse:', JSON.stringify(reversed))

// Non-numeric input must be rejected by the sanitiser.
await input.click()
await input.type('1a.2.3', { delay: 40 })
const sanitised = await page.evaluate(
  () => document.querySelector('input[aria-label^="Amount of"]')?.value,
)
console.log('sanitiser: typed "1a.2.3" ->', JSON.stringify(sanitised))

console.log(`\n=== ERRORS (${errors.length}) ===`)
errors.slice(0, 8).forEach((e) => console.log(e))

await page.screenshot({ path: '.shots/site/rotate-filled.png' })
await browser.close()
