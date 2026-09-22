import { createPublicClient, http, type Address } from 'viem'
import { robinhoodChain } from '@/lib/chain'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import { V4, rotationPath } from './config'

/**
 * Pricing, straight from the pools.
 *
 * The v4 Quoter walks the same curve a real swap would, so this is not an
 * estimate built from mid prices — it is what the trade returns, fees and
 * depth included. It is a state-changing function by signature and a read in
 * practice: it reverts internally to unwind, which is why it can only be
 * reached through `eth_call`.
 */

const client = createPublicClient({ chain: robinhoodChain, transport: http() })

const quoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInput',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'exactCurrency', type: 'address' },
          {
            name: 'path',
            type: 'tuple[]',
            components: [
              { name: 'intermediateCurrency', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' },
              { name: 'hookData', type: 'bytes' },
            ],
          },
          { name: 'exactAmount', type: 'uint128' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

export type V4Quote = {
  amountOut: bigint
  gasEstimate: bigint
}

export class LiquidityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiquidityError'
  }
}

/**
 * Prices a rotation.
 *
 * A size the pools cannot fill does not come back as a bad number — it comes
 * back as a revert, because the swap would push the price past what the
 * available liquidity supports. That is real information and is surfaced as
 * such rather than smoothed into a quote nobody could trade on.
 */
export async function quoteRotation(
  from: TokenSymbol,
  to: TokenSymbol,
  amountIn: bigint,
): Promise<V4Quote> {
  try {
    const { result } = await client.simulateContract({
      address: V4.quoter as Address,
      abi: quoterAbi,
      functionName: 'quoteExactInput',
      args: [
        {
          exactCurrency: TOKENS[from].address,
          path: rotationPath(from, to),
          exactAmount: amountIn,
        },
      ],
    })

    const [amountOut, gasEstimate] = result
    if (amountOut === 0n) {
      throw new LiquidityError('The pools returned nothing for this size.')
    }

    return { amountOut, gasEstimate }
  } catch (error) {
    if (error instanceof LiquidityError) throw error
    throw new LiquidityError(describe(error))
  }
}

/**
 * Turns a quoter revert into something a person can act on.
 *
 * The one that matters is the size limit: these pools are shallow — a few
 * hundred thousand dollars on the XOM side — and a rotation well inside a
 * normal position can exceed them.
 */
function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)

  if (text.includes('0x6190b2b0') || /PriceLimit|OutOfBounds/i.test(text)) {
    return 'That size is past what the pools can fill. Try a smaller amount.'
  }
  if (/insufficient|NotEnough|liquidity/i.test(text)) {
    return 'There is not enough liquidity to fill that.'
  }
  return 'The pools could not price that size.'
}
