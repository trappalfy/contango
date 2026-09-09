import { z } from 'zod'

/** Shapes as returned by https://api.robinhood.com/rhj/ — verified against live responses. */

export const deploymentSchema = z.object({
  contractAddress: z.string(),
  chainId: z.number(),
  networkName: z.string(),
})

export const assetSchema = z.object({
  id: z.string(),
  tokenSymbol: z.string(),
  tokenName: z.string(),
  deployments: z.array(deploymentSchema),
  /** 18-decimal fixed point. Splits and dividends both land here. */
  currentMultiplier: z.string(),
  pendingMultiplier: z.string(),
  status: z.string(),
  logoUrl: z.string().optional(),
  tokenDecimals: z.number(),
  isin: z.string().optional(),
})

export const assetsResponseSchema = z.object({ assets: z.array(assetSchema) })

export const quoteSchema = z.object({
  tokenSymbol: z.string(),
  deployments: z.array(deploymentSchema),
  /** Raw underlying-equity bid/ask. NOT multiplier-adjusted. */
  bid: z.string(),
  ask: z.string(),
  currency: z.string(),
  dailyTradingVolume: z.string().optional(),
  isTradingHalt: z.boolean(),
  generatedAt: z.string(),
  dailyHigh: z.string().optional(),
  dailyLow: z.string().optional(),
  mintBurnTokenVolume: z.string().optional(),
  mintBurnUsdVolume: z.string().optional(),
})

export const pricesResponseSchema = z.object({ quotes: z.array(quoteSchema) })

export const corpActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  processDate: z.object({ year: z.number(), month: z.number(), day: z.number() }),
  tokenSymbol: z.string(),
  details: z
    .object({
      cashDividend: z.object({ underlyingSymbol: z.string(), rate: z.string() }).optional(),
    })
    .optional(),
})

export const corpActionsResponseSchema = z.object({ corpActions: z.array(corpActionSchema) })

export type Asset = z.infer<typeof assetSchema>
export type Quote = z.infer<typeof quoteSchema>
export type CorpAction = z.infer<typeof corpActionSchema>
