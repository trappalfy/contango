import { z } from 'zod'

/**
 * The shapes 1inch actually returns on the Swap API v6.1.
 *
 * Parsed rather than trusted: an aggregator response drives a transaction that
 * spends someone's money, so a field arriving in an unexpected shape has to
 * fail loudly here instead of halfway through a signature.
 */

/** Amounts come back as decimal strings in the token's own base units. */
const baseUnits = z.string().regex(/^\d+$/, 'expected an integer amount in base units')

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'expected an address')
  .transform((value) => value as `0x${string}`)

const hexData = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, 'expected hex calldata')
  .transform((value) => value as `0x${string}`)

/**
 * One hop of the route.
 *
 * 1inch nests these three deep: an array of splits, each an array of parallel
 * paths, each an array of hops. Only `name` and the two ends are worth keeping
 * — the rest is presentation detail from a UI this project does not share.
 */
export const protocolSchema = z.object({
  name: z.string(),
  part: z.number(),
  fromTokenAddress: z.string(),
  toTokenAddress: z.string(),
})

/**
 * Deliberately lenient.
 *
 * The route is display only: it tells someone their rotation goes through
 * USDG. Everything else on the quote is money. So a surprise in this shape
 * has to degrade into "no route shown" rather than reject a response whose
 * amounts were perfectly good — which is what a strict schema would do.
 */
export const protocolsSchema = z
  .array(z.array(z.array(protocolSchema)))
  .catch([])

/** Some deployments report gas as a number, some as a decimal string. */
const gasEstimate = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .optional()
  .catch(undefined)

export const quoteSchema = z.object({
  dstAmount: baseUnits,
  protocols: protocolsSchema.optional(),
  gas: gasEstimate,
})

export const swapSchema = z.object({
  dstAmount: baseUnits,
  protocols: protocolsSchema.optional(),
  // Strict: this is the transaction someone signs.
  tx: z.object({
    from: address,
    to: address,
    data: hexData,
    /** Native value; always "0" for an ERC-20 to ERC-20 rotation. */
    value: baseUnits,
    gas: gasEstimate,
    gasPrice: baseUnits.optional().catch(undefined),
  }),
})

export const spenderSchema = z.object({ address })

export const allowanceSchema = z.object({ allowance: baseUnits })

/** 1inch reports its own failures in the body, with a 4xx alongside. */
export const errorSchema = z.object({
  error: z.string().optional(),
  description: z.string().optional(),
  statusCode: z.number().optional(),
})

export type OneInchQuote = z.infer<typeof quoteSchema>
export type OneInchSwap = z.infer<typeof swapSchema>
export type Protocols = z.infer<typeof protocolsSchema>
