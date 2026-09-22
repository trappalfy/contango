import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The card a link to this site unfurls into.
 *
 * Built rather than drawn, so the wordmark, the palette and the claim can
 * never drift from the site itself. No custom font is loaded: `ImageResponse`
 * would need the file on disk, and the site's faces come from next/font, which
 * does not expose them. The weight and spacing below are chosen to read
 * deliberately in the default grotesque rather than to imitate the serif.
 */

export const alt = 'Contango - two ways to hold oil'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#030305'
const INK = '#FFFFFF'
const COLD = '#AFC0FF'
const ACCENT = '#3F47FF'

export default async function Image() {
  const mark = await readFile(join(process.cwd(), 'public', 'contango-mark.png'))
  const markSrc = `data:image/png;base64,${mark.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          // The hero's glow, flattened to something a static card can carry.
          backgroundImage:
            'radial-gradient(900px 520px at 78% 18%, #1F2255 0%, rgba(31,34,85,0) 70%)',
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} alt="" width={44} height={45} />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: INK,
            }}
          >
            Contango
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, color: INK, letterSpacing: -1 }}>
            Two ways to hold oil.
          </div>
          <div style={{ display: 'flex', width: 132, height: 5, background: ACCENT, marginTop: 30 }} />
          <div style={{ fontSize: 30, lineHeight: 1.4, color: COLD, marginTop: 30, maxWidth: 880 }}>
            One pays a dividend. The other pays to roll futures forward. A terminal for the pair on
            Robinhood Chain.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 20,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.42)',
          }}
        >
          <div style={{ display: 'flex' }}>XOM · USO</div>
          <div style={{ display: 'flex' }}>Chain 4663</div>
        </div>
      </div>
    ),
    size,
  )
}
