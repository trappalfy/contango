import { encodeAbiParameters, encodeFunctionData, parseAbiParameters, type Address, type Hex } from 'viem'
import { robinhoodChain } from '@/lib/chain'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import { POOLS, V4, ZERO_ADDRESS } from './config'

/**
 * The transaction a rotation actually sends.
 *
 * The Universal Router takes a string of one-byte commands and a matching list
 * of encoded inputs. A rotation is two of them: prove the router may move the
 * input token, then swap it along the path. Both ride in one transaction, so
 * after the single lifetime approval to Permit2 a rotation is one signature
 * and one send.
 */

/* ---------------------------------------------------------------- */
/* Command and action opcodes                                        */
/* ---------------------------------------------------------------- */

/** Universal Router commands. */
const PERMIT2_PERMIT = 0x0a
const V4_SWAP = 0x10

/**
 * v4 router actions, executed in the order they appear.
 *
 * The rotation is built from two single-pool swaps rather than one multi-hop
 * action. That is not a stylistic choice: this deployment runs a periphery
 * variant whose structs differ from the published ones — its single-swap
 * parameters carry a `sqrtPriceLimitX96` the documented version does not, and
 * its multi-hop parameters carry a fifth field nothing documents. The
 * single-swap layout below was recovered from a real, successful transaction
 * and verified by re-encoding it byte for byte. The multi-hop one would have
 * been a guess.
 */
const SWAP_EXACT_IN_SINGLE = 0x06
const SETTLE_ALL = 0x0c
const TAKE_ALL = 0x0f

const byte = (value: number) => value.toString(16).padStart(2, '0')
const concatBytes = (...values: number[]): Hex => `0x${values.map(byte).join('')}`

/* ---------------------------------------------------------------- */
/* ABI fragments                                                     */
/* ---------------------------------------------------------------- */

export const universalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

/** Permit2's allowance ledger: amount, when it lapses, and the next nonce. */
export const permit2Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
] as const

/* ---------------------------------------------------------------- */
/* Permit2 signing                                                   */
/* ---------------------------------------------------------------- */

export type PermitSingle = {
  details: { token: Address; amount: bigint; expiration: number; nonce: number }
  spender: Address
  sigDeadline: bigint
}

/** Permit2's domain carries no version field, unlike EIP-2612's. */
export const permit2Domain = {
  name: 'Permit2',
  chainId: robinhoodChain.id,
  verifyingContract: V4.permit2 as Address,
} as const

export const permit2Types = {
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const

/** Thirty days of standing permission, renewed by signature, not by a send. */
export const PERMIT_EXPIRY_SECONDS = 30 * 24 * 60 * 60
/** The signature itself is only good for half an hour. */
export const SIG_DEADLINE_SECONDS = 30 * 60
/** Permit2 stores allowances in 160 bits. */
export const MAX_UINT160 = (1n << 160n) - 1n

export function buildPermitSingle(token: Address, nonce: number, now = Date.now()): PermitSingle {
  const seconds = Math.floor(now / 1000)
  return {
    details: {
      token,
      // Permit2 allowances expire on their own, which is what makes a
      // generous amount reasonable here: it lapses whether or not anyone
      // remembers to revoke it.
      amount: MAX_UINT160,
      expiration: seconds + PERMIT_EXPIRY_SECONDS,
      nonce,
    },
    spender: V4.universalRouter as Address,
    sigDeadline: BigInt(seconds + SIG_DEADLINE_SECONDS),
  }
}

/* ---------------------------------------------------------------- */
/* Encoding                                                          */
/* ---------------------------------------------------------------- */

/**
 * One swap against one pool.
 *
 * This layout is not taken from documentation. It was read out of a
 * transaction that succeeded on this chain and confirmed by decoding and
 * re-encoding that transaction until the bytes matched exactly — including
 * `sqrtPriceLimitX96`, which the published struct does not have.
 */
const exactInSingle = parseAbiParameters(
  '((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData)',
)

const currencyAmount = parseAbiParameters('address currency, uint256 amount')

/** Zero means "take the whole open delta", which is how the hops are joined. */
const OPEN_DELTA = 0n

function encodeSingleSwap(args: {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  zeroForOne: boolean
  amountIn: bigint
  minOut: bigint
}): Hex {
  return encodeAbiParameters(exactInSingle, [
    {
      poolKey: {
        currency0: args.currency0,
        currency1: args.currency1,
        fee: args.fee,
        tickSpacing: args.tickSpacing,
        hooks: ZERO_ADDRESS,
      },
      zeroForOne: args.zeroForOne,
      amountIn: args.amountIn,
      amountOutMinimum: args.minOut,
      // No limit of our own: the minimum output is what protects the trade,
      // and a price limit here would revert on a move the slippage already
      // covers.
      sqrtPriceLimitX96: 0n,
      hookData: '0x',
    },
  ])
}

/**
 * The v4 half: sell the input into USDG, sell the USDG into the output, pay
 * what is owed on the way in and collect what is due on the way out.
 *
 * USDG sits at `currency0` in both pools — its address is numerically below
 * both stock tokens — so the first hop always sells `currency1` and the second
 * always sells `currency0`. The intermediate USDG never reaches the wallet; it
 * stays as a delta inside the manager between the two swaps, which is why the
 * second hop asks for the open delta rather than a figure.
 *
 * `SETTLE_ALL` caps what may leave the wallet at the amount entered, and
 * `TAKE_ALL` floors what must arrive at the slippage-adjusted minimum. That
 * pair is what makes a bad fill revert instead of settling.
 */
function encodeV4Swap(from: TokenSymbol, to: TokenSymbol, amountIn: bigint, minOut: bigint): Hex {
  const leaving = POOLS[from as 'XOM' | 'USO']
  const arriving = POOLS[to as 'XOM' | 'USO']
  const usdg = TOKENS.USDG.address

  const actions = concatBytes(SWAP_EXACT_IN_SINGLE, SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL)

  const params: Hex[] = [
    encodeSingleSwap({
      currency0: usdg,
      currency1: TOKENS[from].address,
      fee: leaving.fee,
      tickSpacing: leaving.tickSpacing,
      zeroForOne: false,
      amountIn,
      minOut: 0n,
    }),
    encodeSingleSwap({
      currency0: usdg,
      currency1: TOKENS[to].address,
      fee: arriving.fee,
      tickSpacing: arriving.tickSpacing,
      zeroForOne: true,
      amountIn: OPEN_DELTA,
      minOut,
    }),
    encodeAbiParameters(currencyAmount, [TOKENS[from].address, amountIn]),
    encodeAbiParameters(currencyAmount, [TOKENS[to].address, minOut]),
  ]

  return encodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), [actions, params])
}

const permitInputType = parseAbiParameters(
  '((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permit, bytes signature',
)

export type RotationCall = {
  to: Address
  data: Hex
  value: bigint
  deadline: bigint
}

/**
 * Builds the whole transaction.
 *
 * When a Permit2 allowance is already standing and unexpired, the permit
 * command is left out entirely and the send costs one command instead of two.
 */
export function buildRotationCall(args: {
  from: TokenSymbol
  to: TokenSymbol
  amountIn: bigint
  minAmountOut: bigint
  permit?: { single: PermitSingle; signature: Hex }
  now?: number
}): RotationCall {
  const deadline = BigInt(Math.floor((args.now ?? Date.now()) / 1000) + SIG_DEADLINE_SECONDS)

  const commands: number[] = []
  const inputs: Hex[] = []

  if (args.permit) {
    commands.push(PERMIT2_PERMIT)
    inputs.push(
      encodeAbiParameters(permitInputType, [args.permit.single, args.permit.signature]),
    )
  }

  commands.push(V4_SWAP)
  inputs.push(encodeV4Swap(args.from, args.to, args.amountIn, args.minAmountOut))

  return {
    to: V4.universalRouter as Address,
    data: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [concatBytes(...commands), inputs, deadline],
    }),
    // ERC-20 in, ERC-20 out. Nothing native moves.
    value: 0n,
    deadline,
  }
}
