import { test } from 'node:test'
import assert from 'node:assert/strict'
import { add, bps, div, formatDec, formatMoney, mid, mul, parseDec, sub, toNumber } from './decimal.ts'

/**
 * The arithmetic every price on the site passes through.
 *
 * Run: node --test --experimental-strip-types "lib/*.test.ts"
 *
 * These are fixed-point on bigint rather than floats, which is the whole point
 * — so the cases that matter are the ones a float gets wrong.
 */

test('parseDec holds a value a float cannot', () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point. Here it must.
  const sum = add(parseDec('0.1'), parseDec('0.2'))
  assert.equal(sum, parseDec('0.3'))
  assert.equal(formatDec(sum, 2), '0.30')
})

test('parseDec keeps eighteen places and truncates beyond them', () => {
  assert.equal(parseDec('1'), 10n ** 18n)
  assert.equal(parseDec('0.000000000000000001'), 1n)
  // More precision than the scale can hold is dropped, not rounded up into it.
  assert.equal(parseDec('0.0000000000000000019'), 1n)
})

test('mul and div round-trip a price', () => {
  const price = parseDec('159.4146')
  const qty = parseDec('12.5')
  assert.equal(formatDec(div(mul(price, qty), qty), 4), '159.4146')
})

test('div by zero throws rather than producing Infinity', () => {
  // A float would hand back Infinity and poison every number downstream of it.
  // Throwing is what stops a missing price becoming a plausible-looking quote.
  assert.throws(() => div(parseDec('1'), 0n), /division by zero/)
})

test('the pair ratio matches the observed one', () => {
  // XOM and USO as the pools priced them; the quotient is what the app trades.
  const ratio = div(parseDec('159.4146'), parseDec('146.3309'))
  assert.equal(formatDec(ratio, 4), '1.0894')
})

test('bps measures a spread against its own mid', () => {
  const bid = parseDec('99.95')
  const ask = parseDec('100.05')
  // A ten-cent spread on a hundred-dollar mid is ten basis points.
  assert.equal(Math.round(bps(sub(ask, bid), mid(bid, ask))), 10)
})

test('formatDec pads rather than truncating the display', () => {
  assert.equal(formatDec(parseDec('1.5'), 4), '1.5000')
  assert.equal(formatDec(parseDec('0'), 2), '0.00')
})

test('formatMoney groups thousands', () => {
  assert.equal(formatMoney(parseDec('1234567.891'), 2), '1,234,567.89')
})

test('negatives survive the round trip', () => {
  const value = sub(parseDec('1'), parseDec('3.5'))
  assert.equal(formatDec(value, 2), '-2.50')
  assert.ok(Math.abs(toNumber(value) + 2.5) < 1e-12)
})
