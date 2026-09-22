import { readFileSync, existsSync } from 'node:fs'

/**
 * Verifies the aggregator integration, end to end, without a wallet.
 *
 * The 1inch client was written against documentation rather than against
 * observed traffic, so every assumption in it — which gateway the key belongs
 * to, the parameter names, the response shape — is a guess until something
 * calls it. This is that something.
 *
 * It works in two passes. First it talks to 1inch directly and prints what
 * actually comes back, so a mismatch is visible rather than inferred. Then it
 * drives the app's own endpoints, which exercises the real client, the real
 * zod schemas and the real route handlers.
 *
 * Run:  node scripts/check-routing.mjs [baseUrl]
 */

const APP = process.argv[2] ?? 'http://localhost:3111'
const CHAIN = 4663
const TOKENS = {
  XOM: { address: '0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5', decimals: 18 },
  USO: { address: '0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344', decimals: 18 },
}
/** A wallet that holds nothing. `disableEstimate` is what makes that fine. */
const PROBE_WALLET = '0x1111111111111111111111111111111111111111'
const AMOUNT = (10n ** 18n).toString() // 1 XOM

/* ---------------------------------------------------------------- */

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const value = match[2].replace(/^["']|["']$/g, '')
      if (value && !process.env[match[1]]) process.env[match[1]] = value
    }
  }
}

loadEnv()
const KEY = process.env.ONEINCH_API_KEY?.trim() ?? ''

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!KEY) {
  console.log(bad('ONEINCH_API_KEY is not set.'))
  console.log('Put it in .env.local (see .env.example) and run this again.')
  process.exit(1)
}
console.log(`key loaded: ${KEY.slice(0, 6)}…${KEY.slice(-4)} (${KEY.length} chars)\n`)

/* ---- pass 1: 1inch directly ------------------------------------- */

const HOSTS = ['https://api.1inch.com', 'https://api.1inch.dev']

async function probe(host, path, params) {
  const query = new URLSearchParams(params).toString()
  const url = `${host}/swap/v6.1/${CHAIN}${path}${query ? `?${query}` : ''}`
  const response = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${KEY}` },
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

console.log('=== pass 1: which gateway accepts this key? ===')
let live = null
for (const host of HOSTS) {
  const { status, body } = await probe(host, '/approve/spender', {})
  const verdict = status === 200 ? ok('ACCEPTED') : bad(`rejected ${status}`)
  console.log(`  ${host.padEnd(24)} ${verdict}  ${status === 200 ? JSON.stringify(body) : dim(JSON.stringify(body)?.slice(0, 90) ?? '')}`)
  if (status === 200 && !live) live = host
  await sleep(1200)
}

if (!live) {
  console.log(bad('\nNeither gateway accepted the key. Check it at portal.1inch.dev.'))
  process.exit(1)
}
console.log(`\n  -> set ONEINCH_BASE_URL=${live} to pin it\n`)

console.log('=== pass 2: raw shapes, so a mismatch is visible ===')
const rawQuote = await probe(live, '/quote', {
  src: TOKENS.XOM.address,
  dst: TOKENS.USO.address,
  amount: AMOUNT,
  includeProtocols: 'true',
  includeGas: 'true',
})
console.log(`  /quote  HTTP ${rawQuote.status}`)
console.log(dim('  ' + JSON.stringify(rawQuote.body)?.slice(0, 500)))

if (rawQuote.status === 200) {
  const b = rawQuote.body
  console.log(`     dstAmount present : ${b?.dstAmount != null ? ok('yes') : bad('NO')}  ${b?.dstAmount ?? ''}`)
  console.log(`     protocols nesting : ${describeNesting(b?.protocols)}`)
  console.log(`     gas field type    : ${typeof b?.gas}`)
}
await sleep(1200)

const rawSwap = await probe(live, '/swap', {
  src: TOKENS.XOM.address,
  dst: TOKENS.USO.address,
  amount: AMOUNT,
  from: PROBE_WALLET,
  slippage: '0.5',
  includeProtocols: 'true',
  disableEstimate: 'true',
})
console.log(`\n  /swap   HTTP ${rawSwap.status}`)
console.log(dim('  ' + JSON.stringify(rawSwap.body)?.slice(0, 400)))
if (rawSwap.status === 200) {
  const tx = rawSwap.body?.tx ?? {}
  console.log(`     tx.to     : ${tx.to ?? bad('missing')}`)
  console.log(`     tx.data   : ${tx.data ? ok(`${tx.data.length} chars`) : bad('missing')}`)
  console.log(`     tx.value  : ${tx.value ?? bad('missing')}`)
  console.log(`     tx.gas    : ${tx.gas ?? dim('absent')} (${typeof tx.gas})`)
}
await sleep(1200)

/* ---- pass 3: the app's own endpoints ---------------------------- */

console.log(`\n=== pass 3: the app itself, at ${APP} ===`)

async function app(path, payload) {
  try {
    const response = await fetch(`${APP}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: response.status, body: await response.json().catch(() => null) }
  } catch (error) {
    return { status: 0, body: { error: String(error) } }
  }
}

const q = await app('/api/quote', { from: 'XOM', to: 'USO', amount: '1' })
if (q.status === 0) {
  console.log(bad(`  server not reachable at ${APP} — start it with: npx next start -p 3111`))
  process.exit(1)
}
const quote = q.body?.quote
console.log(`  /api/quote  HTTP ${q.status}`)
console.log(`     source        : ${quote?.source === 'routed' ? ok('routed') : bad(quote?.source ?? 'none')}`)
console.log(`     amountOut     : ${quote?.amountOut ?? '—'}`)
console.log(`     cost vs mid   : ${quote?.priceImpactBps != null ? `${quote.priceImpactBps} bps` : bad('not computed')}`)
console.log(`     route         : ${quote?.route?.join(', ') || bad('empty')}`)
console.log(`     hops          : ${quote?.hops ?? '—'}${quote?.via ? ` via ${quote.via}` : ''}`)
if (quote?.note) console.log(dim(`     note: ${quote.note}`))
await sleep(1200)

const s = await app('/api/swap', {
  from: 'XOM',
  to: 'USO',
  amount: '1',
  wallet: PROBE_WALLET,
  slippage: 0.5,
})
console.log(`\n  /api/swap   HTTP ${s.status}`)
if (s.body?.ok) {
  const p = s.body.plan
  console.log(`     spender       : ${p.spender}`)
  console.log(`     tx.to         : ${p.to}`)
  console.log(`     calldata      : ${ok(`${p.data.length} chars`)}  selector ${p.data.slice(0, 10)}`)
  console.log(`     amountOut     : ${p.amountOut}`)
  console.log(`     minAmountOut  : ${p.minAmountOut}`)
  console.log(`     route         : ${p.route.join(', ') || dim('none reported')}  (${p.hops} hops)`)
  console.log(`\n  ${ok('ROUTING WORKS.')} The only untested step left is signing and sending.`)
} else {
  console.log(bad(`     ${s.body?.error ?? 'failed'}`))
}

function describeNesting(value) {
  let depth = 0
  let cursor = value
  while (Array.isArray(cursor)) {
    depth++
    cursor = cursor[0]
  }
  const expected = 3
  return depth === expected
    ? ok(`${depth} deep — matches the schema`)
    : bad(`${depth} deep — schema expects ${expected}; route display will be empty`)
}
