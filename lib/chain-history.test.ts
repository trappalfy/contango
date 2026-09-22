import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, priceFrom, type PricePoint } from './chain-history.math.ts'

/**
 * The two pure steps between a swap event and a point on the chart.
 *
 * Run: node --test --experimental-strip-types "lib/*.test.ts"
 */

/** sqrtPriceX96 for a given USDG-per-token price, inverting `priceFrom`. */
function sqrtFor(price: number): bigint {
  return BigInt(Math.round(Math.sqrt(1e12 / price) * 2 ** 96))
}

test('priceFrom recovers the price the pool executed at', () => {
  // Checked against the live feed when this was written: the pools implied
  // 159.41 USDG per XOM against a quoted 159.4 or so.
  const recovered = priceFrom(sqrtFor(159.4146))
  assert.ok(Math.abs(recovered - 159.4146) < 0.001, `got ${recovered}`)
})

test('priceFrom spans the decimal gap between USDG and the stock tokens', () => {
  // Six decimals against eighteen. Getting the shift wrong is a factor of a
  // million, which is the one error this cannot be allowed to make quietly.
  const recovered = priceFrom(sqrtFor(1))
  assert.ok(Math.abs(recovered - 1) < 1e-6, `got ${recovered}`)
})

test('priceFrom refuses a zero price instead of returning Infinity', () => {
  assert.equal(priceFrom(0n), 0)
})

test('join carries the last USO print forward', () => {
  const xom: PricePoint[] = [
    { t: 10, price: 160 },
    { t: 30, price: 170 },
  ]
  const uso: PricePoint[] = [{ t: 5, price: 160 }]

  // One USO print stands until something replaces it, so both XOM prints are
  // priced against it.
  assert.deepEqual(join(xom, uso), [
    { t: 10, price: 1 },
    { t: 30, price: 1.0625 },
  ])
})

test('join drops XOM prints with no USO price behind them', () => {
  const xom: PricePoint[] = [{ t: 1, price: 160 }]
  const uso: PricePoint[] = [{ t: 100, price: 150 }]
  // Pricing against a quote from the future would invent history.
  assert.deepEqual(join(xom, uso), [])
})

test('join sorts before pairing', () => {
  const xom: PricePoint[] = [
    { t: 30, price: 170 },
    { t: 10, price: 160 },
  ]
  const uso: PricePoint[] = [
    { t: 20, price: 100 },
    { t: 5, price: 160 },
  ]

  assert.deepEqual(join(xom, uso), [
    { t: 10, price: 1 },
    { t: 30, price: 1.7 },
  ])
})

test('join is empty when either leg is', () => {
  assert.deepEqual(join([], [{ t: 1, price: 1 }]), [])
  assert.deepEqual(join([{ t: 1, price: 1 }], []), [])
})
