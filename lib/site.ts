/**
 * Where this deployment lives.
 *
 * Absolute URLs are needed in three places that cannot infer them — the
 * sitemap, robots, and the metadata base that turns a relative Open Graph
 * image into something a crawler can fetch. Vercel supplies its own host at
 * build time; `NEXT_PUBLIC_SITE_URL` overrides it with the real domain, which
 * is what a preview deployment must not claim to be.
 */
const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

export const SITE_URL =
  configured || (vercel ? `https://${vercel}` : 'http://localhost:3000')

/** True only on the real domain, so previews stay out of search results. */
export const IS_CANONICAL_HOST = Boolean(configured) || Boolean(vercel)

/** Pages that exist for people. `/render` is a capture stage, not a page. */
export const PUBLIC_ROUTES = ['/', '/spread', '/decay', '/portfolio', '/docs'] as const
