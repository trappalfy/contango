import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { robinhoodChain } from './chain'

/**
 * One chain, browser wallets only.
 *
 * WalletConnect is deliberately left out: it needs a project id, and every
 * wallet that can reach Robinhood Chain today injects a provider anyway.
 * `ssr: true` stops wagmi reading browser storage during the server render,
 * which is what keeps the connected state from causing a hydration mismatch.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [robinhoodChain.id]: http(),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
