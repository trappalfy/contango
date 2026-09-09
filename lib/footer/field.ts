/**
 * The symbol field — §7 of the footer brief.
 *
 * Everything here is pure: a brightness map, a glyph ramp and a colour ramp.
 * No canvas, no React, no time. The renderer owns those, which keeps the shape
 * of the picture testable on its own.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DRAWN
 *
 * The brief's reference image is two hands from the Sistine ceiling reaching
 * for each other, and §7.6 offers the substitution outright: for a trading
 * protocol, the same composition is two order-book curves, bid from one side
 * and ask from the other, with the spread standing in for the gap between the
 * fingertips. That is this product's entire subject, so it is the version
 * built here — and it removes the last external asset, because a depth curve
 * can be computed rather than photographed.
 *
 * The pipeline the brief specifies is otherwise unchanged: a brightness map is
 * sampled onto a cell grid, brightness picks a glyph from a ramp and a colour
 * from a second ramp, and everything is drawn to one canvas in a single pass.
 * ---------------------------------------------------------------------------
 */

/** §7.3 — the ramp, dark to light, used verbatim. */
export const RAMP = ` .,'\`:;-_~^"!|/\\()[]{}?+*irtvxzceounfj17lJYTLCUXZO0Q#MW&@`

/** §7.3 — below this the cell stays empty, and the emptiness draws the shape. */
export const EMPTY_BELOW = 0.06

/**
 * §7.3 — how many neighbouring glyphs count as equivalent at one brightness.
 *
 * A single glyph per level makes flat regions band into stripes of one
 * repeating character, which acceptance criterion 8 forbids.
 */
const EQUIVALENT_GLYPHS = 3

/**
 * §7.4 — the colour ramp, dim to hot.
 *
 * The brief's own ramp is cobalt-to-gold because that is the axis of the
 * droplet in its parent brief. This project's object is the particle sphere,
 * whose axis is `particleCold` to `particleHot`, so the ramp is rebuilt on
 * that axis instead — the instruction being to match the hero's object, not to
 * import another project's hues.
 */
export const COLOR_RAMP: readonly (readonly [number, number, number])[] = [
  [0x1e, 0x24, 0x47], // pc-0 — deep cobalt, the dimmest cells
  [0x33, 0x3a, 0x7a], // pc-1
  [0x5a, 0x62, 0xb8], // pc-2
  [0x8e, 0x93, 0xff], // pc-3 — the accent already used across the UI
  [0xaf, 0xc0, 0xff], // pc-4 — particleCold
  [0xfc, 0xa8, 0xe0], // pc-5 — particleHot, the fingertips
] as const

/** §7.4 — the dim end fades out so edges dissolve instead of being cut off. */
const ALPHA_FLOOR = 0.45

/** §7.2 / §10 — column counts per breakpoint. */
export function columnsFor(width: number): number {
  if (width < 768) return 48
  if (width < 1024) return 96
  if (width < 1280) return 128
  return 156
}

/** §7.2 — cells are slightly taller than wide, matching the mono's rhythm. */
export const CELL_ASPECT = 1.05

/** §10 — below 768 the two curves stack instead of facing each other. */
export function isVertical(width: number): boolean {
  return width < 768
}

/**
 * Half-width of the gap, as a fraction of the long axis.
 *
 * This is the spread, and the copyright sits inside it (§8). It has to clear
 * the widest copyright line at every breakpoint, so it is a fraction rather
 * than a fixed cell count.
 */
const GAP_HALF = 0.14

/** Cumulative depth is a staircase, not a smooth curve — one step per level. */
const BOOK_LEVELS = 16

/**
 * The silhouette's half-thickness at distance `t` from the tip.
 *
 * `t` runs 0 at the inner tip to 1 at the outer edge, and the profile grows
 * outward: a depth chart accumulates volume as price moves away from the mid,
 * which is also what makes the shape read as a limb — thin at the fingertip,
 * thick where it enters the frame.
 */
function halfThickness(t: number): number {
  const raw = 0.045 + 0.29 * Math.pow(t, 0.62)
  // Quantised, because a real book fills level by level. This is what gives
  // the outline its staircase and keeps it from looking like a plain lens.
  return Math.round(raw * BOOK_LEVELS) / BOOK_LEVELS
}

/**
 * How far the limb's centreline drifts off the middle at distance `t`.
 *
 * Zero at the tip and growing outward, applied upward on one side and downward
 * on the other. Without it the two halves are one symmetrical lens sitting on
 * the centreline — a bowtie, not two things reaching. The drift is what makes
 * them read as separate limbs arriving at different angles, and it costs
 * nothing because both tips still land on the middle, where the copyright is.
 */
function centreDrift(t: number): number {
  return 0.14 * Math.pow(t, 0.8)
}

/** Deterministic hash — same cell, same choice, every frame and every reload. */
function hash2(x: number, y: number, salt: number): number {
  let h = x * 374761393 + y * 668265263 + salt * 2246822519
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Brightness for every cell, 0..1, in row-major order.
 *
 * Two silhouettes reach along the long axis and stop short of each other. The
 * value is brightest along the centreline and at the tips, so the hottest
 * cells of the whole field are exactly the two points that fail to touch.
 */
export function buildField(cols: number, rows: number, vertical: boolean): Float32Array {
  const map = new Float32Array(cols * rows)
  // Along the axis the curves travel; across it they have thickness.
  const along = vertical ? rows : cols
  const across = vertical ? cols : rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = ((vertical ? row : col) + 0.5) / along
      const b = ((vertical ? col : row) + 0.5) / across

      // Distance from the mid, folded so both sides share one calculation.
      const fromMid = Math.abs(a - 0.5)
      if (fromMid < GAP_HALF) continue // the spread itself stays empty

      const reach = 0.5 - GAP_HALF
      const t = Math.min(1, (fromMid - GAP_HALF) / reach)
      const half = halfThickness(t)

      // One side drifts up, the other down. Both tips stay on the middle.
      const centre = 0.5 + (a < 0.5 ? -1 : 1) * centreDrift(t)
      const offset = Math.abs(b - centre)
      if (offset > half) continue

      // Falls off toward the silhouette's edge, so the ramp has somewhere to
      // put its faint glyphs instead of ending on a hard cut.
      const body = Math.pow(1 - offset / half, 0.55)
      // And rises toward the tip, which is the subject of the picture.
      const tip = 0.55 + 0.45 * Math.pow(1 - t, 2.2)

      map[row * cols + col] = Math.min(1, body * tip)
    }
  }

  return map
}

/**
 * Where the two tips sit, in cell coordinates.
 *
 * The renderer pulses these (§7.5) and nothing else, so it needs them as
 * numbers rather than re-deriving the geometry.
 */
export function tipCells(
  cols: number,
  rows: number,
  vertical: boolean,
): readonly [{ col: number; row: number }, { col: number; row: number }] {
  const along = vertical ? rows : cols
  const across = vertical ? cols : rows
  const near = Math.round((0.5 - GAP_HALF) * along)
  const far = Math.round((0.5 + GAP_HALF) * along)
  const mid = Math.round(0.5 * across)

  return vertical
    ? [
        { col: mid, row: near },
        { col: mid, row: far },
      ]
    : [
        { col: near, row: mid },
        { col: far, row: mid },
      ]
}

/**
 * The glyph for a cell.
 *
 * `salt` is what the renderer advances on the small share of cells it refreshes
 * each frame: the brightness is untouched, so only the letterform changes.
 */
export function glyphFor(brightness: number, col: number, row: number, salt: number): string {
  if (brightness < EMPTY_BELOW) return ''

  const top = RAMP.length - 1
  const index = Math.round(brightness * top)
  // A window of equivalent glyphs around the exact index, picked per cell.
  const spread = Math.min(EQUIVALENT_GLYPHS, top + 1)
  const lowest = Math.max(0, Math.min(top - spread + 1, index - (spread >> 1)))

  return RAMP[lowest + (hash2(col, row, salt) % spread)]
}

/** Which of the six ramp stops a brightness belongs to. */
export function stopFor(brightness: number): number {
  const last = COLOR_RAMP.length - 1
  return Math.max(0, Math.min(last, Math.round(brightness * last)))
}

/** `rgba()` for one ramp stop, with the dim end faded out (§7.4). */
export function stopColor(stop: number): string {
  const last = COLOR_RAMP.length - 1
  const [r, g, b] = COLOR_RAMP[stop]
  const alpha = ALPHA_FLOOR + (1 - ALPHA_FLOOR) * (stop / last)
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}
