import { HAIRLINE } from '@/components/ui/primitives'

/** Holds the board's footprint while the quote feed answers. */
export function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div style={{ height: 22, width: 260, background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} style={{ border: `1px solid ${HAIRLINE}`, height: 320 }} />
        ))}
      </div>
    </div>
  )
}
