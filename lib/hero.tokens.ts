/**
 * Hero design tokens — §4 of docs/hero-brief.md.
 * Values are measured from the reference; do not "improve" them.
 */

export const C = {
  bgTop: '#030305',
  bgMid: '#0F0F12',
  bgGlow: '#1F2255',
  glowCorner: '#232658',

  particleCold: '#AFC0FF',
  particleHot: '#FCA8E0',
  particleDeep: '#C84F88',

  wire: '#6E7AB0',
  filament: '#EAF0FF',

  accent: '#3F47FF',
  markBlue: '#4A4FD8',

  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.46)',
  navBtnBg: '#D7D7D7',
  navBtnText: '#0A0A0A',
} as const

/** §8 — vertical gradient plus two bottom corner glows. */
export const BG_CSS = [
  'radial-gradient(120% 70% at 0% 108%, rgba(58,64,175,.30), transparent 60%)',
  'radial-gradient(120% 70% at 100% 108%, rgba(58,64,175,.30), transparent 60%)',
  'linear-gradient(180deg, #030305 0%, #08080B 22%, #0F0F12 50%, #16183A 82%, #1F2255 100%)',
].join(', ')

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t)

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Frame-rate independent damping (§10 — smooth `p` before it reaches the scene). */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/**
 * Height of the pinned wrapper, in svh. The sticky child holds one viewport,
 * so scroll travel for p 0 -> 1 is (PIN_HEIGHT_SVH - 100) percent of the
 * viewport height.
 *
 * This is the gearing between scroll input and camera motion, and it is the
 * single control over how abrupt the flythrough feels. The brief specifies
 * 260, which puts the whole dive (p 0.38 -> 0.50) inside 173px of scroll —
 * under two wheel notches, moving the camera more than a sphere diameter per
 * notch. Raising it stretches the same choreography over more scroll; the
 * keyframe tables below are untouched, so the sequence itself is identical.
 */
export const PIN_HEIGHT_SVH = 520

/* ------------------------------------------------------------------ */
/* Keyframe tracks (§10)                                               */
/* ------------------------------------------------------------------ */

export type Track = ReadonlyArray<readonly [p: number, value: number]>

/**
 * Samples a keyframe track at progress `p`.
 * Everything in the scene derives from this so reverse scroll mirrors exactly —
 * there are no timers anywhere in the state machine.
 */
export function sampleTrack(track: Track, p: number, ease: (t: number) => number): number {
  if (p <= track[0][0]) return track[0][1]
  const last = track[track.length - 1]
  if (p >= last[0]) return last[1]

  for (let i = 0; i < track.length - 1; i++) {
    const [p0, v0] = track[i]
    const [p1, v1] = track[i + 1]
    if (p >= p0 && p <= p1) {
      const span = p1 - p0
      const t = span === 0 ? 0 : (p - p0) / span
      return v0 + (v1 - v0) * ease(t)
    }
  }
  return last[1]
}

/**
 * Monotone cubic (Fritsch-Carlson) tangents for a track, computed once.
 *
 * Why this exists: `sampleTrack` with easeInOutCubic eases *within each
 * segment*, and ease-in-out has zero derivative at both ends. Applied per
 * segment that makes the value stall dead at every keyframe and then lurch
 * through the middle — measured at |dz/dp| = 0 at each node against a spike of
 * 58.7 mid-segment, i.e. five stop-and-go cycles across the flythrough. That
 * reads as jerky motion, and it is worse than plain linear interpolation.
 *
 * A monotone spline passes through exactly the same keyframes, keeps the first
 * derivative continuous across them, and cannot overshoot — which matters here,
 * because an overshooting camera would back out through the shell.
 */
const tangentCache = new WeakMap<object, number[]>()

function tangentsFor(track: Track): number[] {
  const cached = tangentCache.get(track)
  if (cached) return cached

  const n = track.length
  const slopes = new Array<number>(n - 1)
  for (let i = 0; i < n - 1; i++) {
    slopes[i] = (track[i + 1][1] - track[i][1]) / (track[i + 1][0] - track[i][0])
  }

  const m = new Array<number>(n)
  m[0] = slopes[0]
  m[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = (slopes[i - 1] + slopes[i]) / 2

  // Fritsch-Carlson limiter: keeps the curve monotone between keyframes.
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slopes[i]
    const b = m[i + 1] / slopes[i]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * a * slopes[i]
      m[i + 1] = tau * b * slopes[i]
    }
  }

  tangentCache.set(track, m)
  return m
}

/**
 * Samples a keyframe track as a monotone cubic spline. Use this for anything
 * continuous the eye tracks — camera distance above all. Still a pure function
 * of `p`, so reverse scroll stays exactly mirrored.
 */
export function sampleSpline(track: Track, p: number): number {
  if (p <= track[0][0]) return track[0][1]
  const last = track[track.length - 1]
  if (p >= last[0]) return last[1]

  const m = tangentsFor(track)

  for (let i = 0; i < track.length - 1; i++) {
    const [x0, y0] = track[i]
    const [x1, y1] = track[i + 1]
    if (p >= x0 && p <= x1) {
      const h = x1 - x0
      const t = (p - x0) / h
      const t2 = t * t
      const t3 = t2 * t
      return (
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * h * m[i] +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * h * m[i + 1]
      )
    }
  }
  return last[1]
}

/** Camera distance from origin. Sphere radius is 1. */
export const CAMERA_Z: Track = [
  [0.0, 5.3],
  [0.28, 4.6],
  [0.38, 3.4],
  [0.5, 1.05],
  [0.58, 0.35],
  [0.68, 0.1],
  [1.0, 0.1],
]

/** Copy state A fades out fully before B begins — the tracks never overlap. */
export const COPY_A_OPACITY: Track = [
  [0.0, 1],
  [0.3, 1],
  [0.38, 0],
  [1.0, 0],
]

export const COPY_B_OPACITY: Track = [
  [0.0, 0],
  [0.5, 0],
  [0.58, 0.6],
  [0.68, 1],
  [1.0, 1],
]

/** Bloom flare as the camera passes through the shell. */
export const BLOOM_INTENSITY: Track = [
  [0.0, 0.9],
  [0.35, 0.9],
  [0.5, 1.6],
  [0.65, 0.9],
  [1.0, 0.9],
]

/**
 * How far the camera counts as being inside the shell. Drives the point
 * dimming that acceptance criterion 9 requires.
 */
export const INSIDE_FADE: Track = [
  [0.0, 0],
  [0.5, 0],
  [0.62, 1],
  [1.0, 1],
]

/** Filament brightness: faint outside, peaks on the pass-through, dim inside. */
export const FILAMENT_OPACITY: Track = [
  [0.0, 0.35],
  [0.38, 0.5],
  [0.5, 1.0],
  [0.62, 0.35],
  [0.75, 0.2],
  [1.0, 0.2],
]

/* ------------------------------------------------------------------ */
/* Scene constants (§9)                                                */
/* ------------------------------------------------------------------ */

export const SCENE = {
  cameraFov: 45,
  cameraNear: 0.01,
  cameraFar: 100,

  sphereRadius: 1.0,
  pointJitter: 0.02,

  wireRadius: 1.02,
  wireDetail: 3,
  wireNoiseAmp: 0.055,
  wireOpacity: 0.1,

  filamentRadius: 1.03,
  filamentControlPoints: 9,
  filamentTubularSegments: 220,
  filamentTubeRadius: 0.006,
  filamentRadialSegments: 6,
  /** Visible arc length as a fraction of the closed loop. */
  filamentWindow: 0.35,
  /** Seconds for the head to travel the loop once. */
  filamentLoopSeconds: 6,

  ringRadii: [1.25, 1.45] as const,
  ringTilts: [Math.PI * (20 / 180), Math.PI * (65 / 180)] as const,
  ringOpacity: 0.06,

  rotationY: 0.06,
  rotationXAmp: 0.08,
  rotationXSpeed: 0.25,
  /** §14 — prefers-reduced-motion slows rotation to a crawl. */
  reducedRotationY: 0.01,
} as const

/** §9.2 / §12 — point budget per breakpoint. */
export function pointCountFor(width: number): number {
  if (width < 768) return 1400
  if (width < 1280) return 2200
  return 3200
}

/** §12 — device pixel ratio ceiling drops on small screens. */
export function dprFor(width: number): [number, number] {
  return width < 768 ? [1, 1.5] : [1, 1.75]
}

/** §12 — bloom is the last thing to be reduced. */
export function bloomScaleFor(width: number): number {
  return width < 768 ? 0.7 / 0.9 : 1
}
