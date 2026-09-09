# Contango

A terminal for the two oil-linked instruments that exist on Robinhood Chain.

**XOM** is an equity token: ExxonMobil sells the barrel, earns on it, and pays a dividend.
**USO** is a fund token: it holds front-month crude futures and must roll them forward every
month. When the far month costs more than the near one — contango — every roll buys back
less exposure than it sold.

Both track the same commodity. One leaks value on a schedule and the other accrues it, which
gives the ratio between them a structural tilt on top of the noise. Contango prices that gap
live and lets you rotate capital between the two legs.

There is no vault, no deposit, and no contract of ours in the path. A rotation is a swap that
lands in your own wallet.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · wagmi + viem ·
three / react-three-fiber for the hero · Playwright for verification.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

For anything to do with performance, final layout, or the WebGL hero, use a production build
instead — `next dev` compiles on demand and runs React's Strict Mode double-invocation, and
the 3D scene is markedly slower there:

```bash
npm run build
npm start
```

## Environment

Nothing is required to run the site: it falls back to the chain's public RPC and prices the
form from live mid quotes.

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Replaces the public Robinhood Chain RPC, which the chain docs rate-limit and do not recommend for production. |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | The swap router. Until it is set, the rotation form prices and validates but cannot execute. |
| `ONEINCH_API_KEY` | Turns `/api/quote` from an indicative mid-price quote into a routed one with real pool depth and price impact. |

`NEXT_PUBLIC_*` values are inlined at build time — changing them needs a rebuild, not just a
restart. `ONEINCH_API_KEY` is read per request on the server, so a restart is enough.

## What is live, and what is not

Live and wired up:

- Robinhood's own registry and quote feed (`/rhj/assets`, `/rhj/prices`, `/rhj/corporate-actions`),
  cached in the server process because the quote endpoint rate-limits hard
- Wallet connection, chain switching, and balance reads straight from the token contracts
- The recorded XOM/USO ratio series and its normal band
- The subscribe form in the footer

Not wired up:

- **Rotation routing.** `app/api/quote/route.ts` is the seam: it returns an indicative quote
  from mid prices today, and swapping in the 1inch Swap API for chain 4663 there is the only
  change the rest of the app needs.
- Deep price history and the futures curve, both of which need a market-data provider.

## The conversion that matters

Stock tokens are ordinary ERC-20s, but splits and dividends are applied through a multiplier
rather than by changing balances: one token represents `uiMultiplier()` underlying shares.
The REST feed returns the raw, unadjusted underlying price; the onchain Chainlink feed is
adjusted. Mixing the two without converting is how an integration double-counts a split.

Every price on this site is multiplied exactly once, in `lib/pair.ts`, and nowhere else.

## Storage

Two stores are deliberately simple and single-node, and both are marked in the code as the
place a real database goes:

- `lib/history.ts` — the ratio series, a process-local ring buffer that dies with the server
- `app/api/subscribe/route.ts` — subscribers, a JSON file under `.data/`

## Chain

Robinhood Chain, an Arbitrum Orbit L2 with native ETH. Chain ID **4663**, settlement in USDG,
explorer at [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com).

Stock Tokens are not available in the United States, and availability elsewhere depends on
your jurisdiction. Contango is an interface over public data — not a broker, not an issuer,
not affiliated with Robinhood Markets, and nothing here is investment advice.
