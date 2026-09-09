import { defineChain } from 'viem'

/**
 * Robinhood Chain, from docs.robinhood.com/chain/connecting.
 *
 * The public RPC works but the chain docs explicitly do not recommend it for
 * production, so an Alchemy URL takes priority when one is configured.
 */
const PUBLIC_RPC = 'https://rpc.mainnet.chain.robinhood.com'

const configuredRpc = process.env.NEXT_PUBLIC_RPC_URL?.trim()

export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [configuredRpc || PUBLIC_RPC] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
})

export const RPC_IS_PUBLIC = !configuredRpc

export const explorerAddress = (address: string) =>
  `${robinhoodChain.blockExplorers.default.url}/address/${address}`

export const explorerTx = (hash: string) =>
  `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`
