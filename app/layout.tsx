import type { Metadata } from 'next'
import { Azeret_Mono, Instrument_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/hero/Nav'
import { Footer } from '@/components/site/Footer'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { ToastProvider } from '@/components/ui/Toast'

/**
 * Three faces, three jobs.
 *
 * Display type is the serif and nothing else — it is an editorial face that
 * falls apart below about 20px, so headlines are its whole remit. Running text
 * and interface labels take the companion sans, and every number on the site
 * takes the mono, which is what keeps columns of prices aligned.
 */
const displaySerif = Instrument_Serif({
  variable: '--font-display-serif',
  subsets: ['latin'],
  // The family ships one upright weight. There is no lighter cut to reach for.
  weight: '400',
})

const bodySans = Instrument_Sans({
  variable: '--font-sans-ui',
  subsets: ['latin'],
  // Variable: one file covers 400-700. Its axis starts at 400, so the old 300
  // has no equivalent in this family.
})

const dataMono = Azeret_Mono({
  variable: '--font-mono-data',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Contango - two ways to hold oil',
  description:
    'USO holds futures and pays to roll them forward. XOM sells the same barrel and pays a dividend. Contango tracks the gap and lets you rotate between them onchain.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${displaySerif.variable} ${bodySans.variable} ${dataMono.variable} antialiased`}
    >
      <body>
        <Web3Provider>
          <ToastProvider>
            <Nav />
            {children}
            <Footer />
          </ToastProvider>
        </Web3Provider>
      </body>
    </html>
  )
}
