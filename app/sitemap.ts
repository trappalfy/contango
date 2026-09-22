import type { MetadataRoute } from 'next'
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/site'

/**
 * Five pages, and no invented dates.
 *
 * `changeFrequency` is a hint crawlers largely ignore, but the two pages whose
 * numbers move every twenty seconds are worth marking differently from the
 * ones that only change when someone edits them.
 */
const LIVE = new Set<string>(['/spread', '/portfolio'])

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === '/' ? '' : route}`,
    changeFrequency: LIVE.has(route) ? ('hourly' as const) : ('monthly' as const),
    priority: route === '/' ? 1 : LIVE.has(route) ? 0.8 : 0.5,
  }))
}
