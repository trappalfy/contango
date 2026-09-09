import type { ReactNode } from 'react'
import { Container, Display, Eyebrow, Body } from '@/components/ui/primitives'

/** Top of every page below the hero. Clears the fixed navbar. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  lede: ReactNode
  aside?: ReactNode
}) {
  return (
    <header style={{ paddingTop: 'clamp(96px, 12vw, 168px)', paddingBottom: 'clamp(40px, 5vw, 72px)' }}>
      <Container>
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="mt-6">
          <Display as="h1" measure={18}>
            {title}
          </Display>
        </div>
        <div className="mt-7 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Body wide>{lede}</Body>
          {aside}
        </div>
      </Container>
    </header>
  )
}
