import type { Address } from 'viem'

/**
 * The three tokens this app touches, with addresses read from the chain's own
 * registry (api.robinhood.com/rhj/assets) and the chain contracts page.
 *
 * Every stock token is a standard ERC-20 with 18 decimals; USDG is the
 * settlement stablecoin on Robinhood Chain.
 */
export type TokenMeta = {
  symbol: string
  name: string
  address: Address
  decimals: number
  kind: 'stock' | 'stable'
}

export const TOKENS = {
  XOM: {
    symbol: 'XOM',
    name: 'ExxonMobil',
    address: '0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5',
    decimals: 18,
    kind: 'stock',
  },
  USO: {
    symbol: 'USO',
    name: 'United States Oil Fund',
    address: '0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344',
    decimals: 18,
    kind: 'stock',
  },
  USDG: {
    symbol: 'USDG',
    name: 'Global Dollar',
    address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    decimals: 6,
    kind: 'stable',
  },
} as const satisfies Record<string, TokenMeta>

export type TokenSymbol = keyof typeof TOKENS

export const TRACKED: TokenSymbol[] = ['XOM', 'USO', 'USDG']

/** The two legs of the pair, in the order the UI presents them. */
export const LEGS: TokenSymbol[] = ['XOM', 'USO']

export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/**
 * ERC-8056 scaled UI amount. Stock tokens apply splits and dividends through
 * this multiplier rather than by changing balances, so a balance alone is not
 * a position — it has to be scaled by this to reach underlying shares.
 */
export const scaledTokenAbi = [
  {
    type: 'function',
    name: 'uiMultiplier',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`
