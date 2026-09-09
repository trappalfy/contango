/** Pure-logic checks that do not need a browser or a live feed. */
let failures = 0
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(actual)}\n      want ${JSON.stringify(expected)}`}`)
}

/* ---- band(): mean, sd and z from a known series ---- */
const MIN = 20
function band(samples) {
  if (samples.length < MIN) return null
  const v = samples.map((s) => s.ratio)
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
  const latest = v[v.length - 1]
  return { mean, sd, z: sd > 0 ? (latest - mean) / sd : null, count: v.length }
}

check('band is withheld below the minimum', band(Array.from({ length: 19 }, () => ({ ratio: 1 }))), null)

const flat = Array.from({ length: 20 }, () => ({ ratio: 1.09 }))
check('flat series has no z (sd is zero)', band(flat).z, null)

// 19 ones and a two: mean 1.05, sd 0.2179..., z = (2-1.05)/sd
const spike = [...Array.from({ length: 19 }, () => ({ ratio: 1 })), { ratio: 2 }]
const b = band(spike)
check('mean of the spiked series', Number(b.mean.toFixed(4)), 1.05)
check('z of the spiked series', Number(b.z.toFixed(3)), 4.359)

/* ---- classifyError(): wallet errors map onto actionable reasons ---- */
function classifyError(error) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const lower = message.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request') || lower.includes('4001')) return 'rejected'
  if (lower.includes('slippage') || lower.includes('min return') || lower.includes('insufficient output')) return 'slippage'
  if (lower.includes('deadline') || lower.includes('expired')) return 'deadline'
  if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) return 'insufficient'
  if (lower.includes('reverted') || lower.includes('execution reverted')) return 'reverted'
  return 'unknown'
}

check('MetaMask rejection', classifyError(new Error('MetaMask Tx Signature: User denied transaction signature.')), 'rejected')
check('EIP-1193 code 4001', classifyError(new Error('Request failed with code 4001')), 'rejected')
check('slippage revert', classifyError(new Error('execution reverted: Slippage limit exceeded')), 'slippage')
check('deadline revert', classifyError(new Error('Transaction deadline expired')), 'deadline')
check('insufficient funds', classifyError(new Error('insufficient funds for gas * price + value')), 'insufficient')
check('plain revert', classifyError(new Error('execution reverted')), 'reverted')
check('unrecognised', classifyError(new Error('socket hang up')), 'unknown')

/* ---- roll decay arithmetic shown on /decay ---- */
const annual = (m) => (Math.pow(1 / (1 + m / 100), 12) - 1) * 100
check('1.5% monthly contango over a year', Number(annual(1.5).toFixed(2)), -16.36)
check('0.5% backwardation is a tailwind', Number(annual(-0.5).toFixed(2)), 6.2)

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
