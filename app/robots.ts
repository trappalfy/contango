import type { MetadataRoute } from 'next'
import { IS_CANONICAL_HOST, SITE_URL } from '@/lib/site'

/**
 * `/render` is a 1920x1080 capture stage that mounts a WebGL scene and hides
 * the site's own chrome. It is not a page, and a crawler finding it would
 * index a frame of a video as though it were content.
 *
 * A deployment with no canonical host set is a preview or a local build, and
 * is disallowed wholesale rather than left to compete with the real domain.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_CANONICAL_HOST) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/render', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
