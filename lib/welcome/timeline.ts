/**
 * The welcome film's timeline — §5 and §6 of contango-welcome-video-spec.md.
 *
 * One pure function, `stateAt(frame)`. No clock, no requestAnimationFrame, no
 * randomness: frame number in, complete scene description out. That is what
 * makes a capture reproducible and what lets a single beat be retimed without
 * disturbing the other eleven seconds.
 *
 * Nothing here imports three.js. The scene consumes this; it does not produce
 * it.
 */

/** Not to be changed — the number of rolls in a year. */
export const ROLLS = 12

export const FPS = 30
export const TOTAL_FRAMES = 360

/** §2 — the film loops in the feed, so both ends dip through black. */
const FADE_FRAMES = 6

/** §5 — hard cuts, no cross-fades. Each beat is [first, last] inclusive. */
export const BEATS = [
  { beat: 1, from: 0, to: 59 },
  { beat: 2, from: 60, to: 125 },
  { beat: 3, from: 126, to: 185 },
  { beat: 4, from: 186, to: 227 },
  { beat: 5, from: 228, to: 251 },
  { beat: 6, from: 252, to: 275 },
  { beat: 7, from: 276, to: 359 },
] as const

/** §5 — the first ring leaves here, the rest follow every third frame. */
const RING_FIRST_FRAME = 128
const RING_STAGGER = 3
const RING_FLIGHT = 22

/**
 * §5 — ring positions advance every third frame, not every frame.
 *
 * The footer's symbol field already moves on a coarse step, and the reason is
 * the same here: stepped motion reads as data refreshing, smooth motion reads
 * as smoke.
 */
const RING_STEP = 3

/** §5 — the sphere parts along X, and the camera pulls back as it does. */
const SPLIT_X = 1.6

/** §5 — one beat's worth of rotation, in radians per second. */
const ROTATION_PER_SECOND = 0.15

/** §6 — text arrives over 8 frames and leaves instantly on the cut. */
const TEXT_IN_FRAMES = 8
const TEXT_RISE_PX = 12

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Smooth, symmetric, and zero-derivative at both ends. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Progress through a closed frame range, 0 at `from` and 1 at `to`. */
function through(frame: number, from: number, to: number): number {
  return clamp01((frame - from) / (to - from))
}

export function beatAt(frame: number): number {
  for (const b of BEATS) if (frame >= b.from && frame <= b.to) return b.beat
  return frame < 0 ? 1 : 7
}

export type RingState = {
  /** Latitude in radians, fixed for the life of the ring. */
  latitude: number
  /** Multiplier on the ring's resting radius — 1 while attached. */
  scale: number
  /** Travel away from the sphere along X. */
  offsetX: number
  opacity: number
  visible: boolean
}

export type TextBlock = {
  id: string
  /** 0 while hidden, rising to 1 over the beat's opening frames. */
  enter: number
}

export type WelcomeState = {
  frame: number
  /** Seconds, derived from the frame index and nothing else. */
  t: number
  beat: number
  /** §5 — the 3D layer is gone from beat 5 onward; the background stays. */
  sceneVisible: boolean
  camera: { x: number; y: number; z: number }
  /** Shared by both spheres — they are one object that came apart. */
  rotationY: number
  leftX: number
  rightX: number
  rings: RingState[]
  /** §2 — 1 is full black. Covers the whole frame, typography included. */
  blackout: number
  text: TextBlock | null
}

/** §4 — twelve latitudes, evenly spaced from −70° to +70°. */
export function ringLatitudes(): number[] {
  const span = 140
  return Array.from({ length: ROLLS }, (_, i) => {
    const degrees = -70 + (span * i) / (ROLLS - 1)
    return (degrees * Math.PI) / 180
  })
}

const LATITUDES = ringLatitudes()

function ringAt(index: number, frame: number): RingState {
  const latitude = LATITUDES[index]
  const start = RING_FIRST_FRAME + index * RING_STAGGER

  if (frame < start) {
    // Still part of the sphere.
    return { latitude, scale: 1, offsetX: 0, opacity: 1, visible: true }
  }

  // Quantised: the ring holds each position for three frames before moving.
  const elapsed = Math.floor((frame - start) / RING_STEP) * RING_STEP
  const p = clamp01(elapsed / RING_FLIGHT)

  return {
    latitude,
    scale: 1 + 0.9 * p,
    offsetX: 0.8 * p,
    opacity: 1 - p,
    visible: p < 1,
  }
}

/** §6 — 8 frames of fade and rise from the moment a block's beat opens. */
function textAt(frame: number): TextBlock | null {
  const beat = beatAt(frame)
  const id =
    beat === 2
      ? 'two-ways'
      : beat === 3
        ? 'only-one'
        : beat === 4
          ? 'roll-math'
          : beat === 5
            ? 'count'
            : beat === 6
              ? 'not-a-bad-trade'
              : beat === 7
                ? 'card'
                : null

  if (!id) return null

  const opened = BEATS.find((b) => b.beat === beat)!.from
  return { id, enter: clamp01((frame - opened) / TEXT_IN_FRAMES) }
}

/** How far a text block still has to rise, in pixels. */
export function textOffsetPx(enter: number): number {
  return (1 - easeInOut(enter)) * TEXT_RISE_PX
}

export function stateAt(frame: number): WelcomeState {
  const beat = beatAt(frame)
  const t = frame / FPS

  // §5 — camera per beat. Beats 5-7 keep the last position; nothing renders.
  let z = 2.6
  let x = 0

  if (beat === 2) {
    z = 2.6 + (4.6 - 2.6) * easeInOut(through(frame, 60, 125))
  } else if (beat === 3) {
    z = 4.6
  } else if (beat >= 4) {
    const p = easeInOut(through(frame, 186, 227))
    z = 4.6 + (1.9 - 4.6) * p
    // Drifts toward the sphere that is losing its rings.
    x = SPLIT_X * 0.72 * p
  }

  // §5 — the split happens across beat 2 and holds afterwards.
  const split = beat === 1 ? 0 : SPLIT_X * easeInOut(through(frame, 60, 125))

  // §2 — out of black at the head, into black at the tail, so the loop is flat.
  const fadeIn = 1 - clamp01(frame / FADE_FRAMES)
  const fadeOut = clamp01((frame - (TOTAL_FRAMES - 1 - FADE_FRAMES)) / FADE_FRAMES)

  return {
    frame,
    t,
    beat,
    sceneVisible: beat <= 4,
    camera: { x, y: 0, z },
    rotationY: t * ROTATION_PER_SECOND,
    leftX: -split,
    rightX: split,
    rings: Array.from({ length: ROLLS }, (_, i) => ringAt(i, frame)),
    blackout: Math.max(fadeIn, fadeOut),
    text: textAt(frame),
  }
}

/**
 * How many rings have fully left the sphere by this frame.
 *
 * Exists for the acceptance check in §11 — "exactly 12 by frame 200, not 11 and
 * not 13" — so the count can be asserted rather than eyeballed.
 */
export function ringsDeparted(frame: number): number {
  return stateAt(frame).rings.filter((r) => !r.visible).length
}
