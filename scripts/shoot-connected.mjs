import { chromium } from 'playwright'

/**
 * Drives the connected states of the rotation form.
 *
 * Two test doubles, both at a boundary rather than inside the app: an injected
 * EIP-1193 provider so the connector finds a wallet, and a stubbed JSON-RPC
 * endpoint so a balance exists to spend. Nothing the product ships is mocked.
 */
const BASE = process.argv[2] ?? 'http://localhost:3111'
const OUT = '.shots/site'
const ACCOUNT = '0x1111111111111111111111111111111111111111'
const errors = []

const hex = (n) => '0x' + n.toString(16).padStart(64, '0')
const BALANCE = hex(100n * 10n ** 18n) // 100 tokens
const ONE = hex(10n ** 18n)

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })

page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text())
})

// Stub the chain's RPC so balances are non-zero.
await page.route('**/rpc.mainnet.chain.robinhood.com/**', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}')
  const answer = (req) => {
    switch (req.method) {
      case 'eth_chainId':
        return '0x1237'
      case 'eth_blockNumber':
        return '0x1'
      case 'eth_call': {
        const data = req.params?.[0]?.data ?? ''
        if (data.startsWith('0x70a08231')) return BALANCE // balanceOf
        if (data.startsWith('0xa60bf13d')) return ONE // uiMultiplier
        return '0x'
      }
      default:
        return null
    }
  }
  const reply = Array.isArray(body)
    ? body.map((r) => ({ jsonrpc: '2.0', id: r.id, result: answer(r) }))
    : { jsonrpc: '2.0', id: body.id, result: answer(body) }

  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) })
})

// Inject a wallet before any app code runs.
await page.addInitScript(
  ({ account }) => {
    const listeners = {}
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method }) => {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            return [account]
          case 'eth_chainId':
            return '0x1237'
          case 'net_version':
            return '4663'
          case 'wallet_switchEthereumChain':
            return null
          default:
            return null
        }
      },
      on: (event, handler) => {
        ;(listeners[event] ||= []).push(handler)
      },
      removeListener: () => {},
    }
  },
  { account: ACCOUNT },
)

await page.goto(`${BASE}/spread`, { waitUntil: 'commit' })
await page.waitForSelector('input[aria-label^="Amount of"]', { timeout: 25000 })
await page.waitForTimeout(1500)

// Connect through the real modal.
await page.getByRole('button', { name: 'Connect', exact: true }).first().click()
await page.waitForTimeout(500)
const connector = page.locator('[role="dialog"] button').filter({ hasText: /MetaMask|Injected|Browser/i }).first()
if (await connector.count()) await connector.click()
await page.waitForTimeout(2500)

const connected = await page.evaluate(() => document.body.innerText.includes('0x1111'))
console.log('connected:', connected)

const balanceText = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => /^Balance /.test(s.textContent ?? ''))
  return el?.textContent?.trim() ?? null
})
console.log('balance shown:', JSON.stringify(balanceText))

await page.locator('input[aria-label^="Amount of"]').fill('10')
await page.waitForTimeout(3500)

const action = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    /Routing not connected|Rotate|Insufficient|Pricing|Enter an amount/i.test(x.textContent ?? ''),
  )
  return b ? { label: b.textContent.trim(), disabled: b.disabled } : null
})
console.log('action:', JSON.stringify(action))

await page.screenshot({ path: `${OUT}/connected-form.png` })

if (action && !action.disabled) {
  await page.getByRole('button', { name: /Routing not connected|Rotate/i }).click()
  await page.waitForTimeout(1200)
}

const status = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('[role="status"]')]
  return panels.map((p) => p.innerText.replace(/\n+/g, ' | ')).filter(Boolean)
})
console.log('status panels:', JSON.stringify(status, null, 1))

const box = await page.locator('input[aria-label^="Amount of"]').boundingBox()
await page.screenshot({
  path: `${OUT}/tx-status.png`,
  clip: box ? { x: box.x - 44, y: box.y - 130, width: 520, height: 900 } : undefined,
})

console.log(`\n=== ERRORS (${errors.length}) ===`)
errors.slice(0, 10).forEach((e) => console.log(e))
await browser.close()
