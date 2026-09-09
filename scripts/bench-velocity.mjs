/** Compares the per-segment ease against a monotone cubic (PCHIP) spline. */
const CAMERA_Z = [[0,5.3],[0.28,4.6],[0.38,3.4],[0.5,1.05],[0.58,0.35],[0.68,0.1],[1,0.1]]
const easeInOutCubic = (t) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2)

function perSegmentEase(track, p) {
  if (p <= track[0][0]) return track[0][1]
  const last = track[track.length-1]
  if (p >= last[0]) return last[1]
  for (let i=0;i<track.length-1;i++){
    const [p0,v0]=track[i],[p1,v1]=track[i+1]
    if (p>=p0&&p<=p1){ const t=(p-p0)/(p1-p0); return v0+(v1-v0)*easeInOutCubic(t) }
  }
  return last[1]
}

/* Fritsch-Carlson monotone cubic tangents. */
function tangents(track) {
  const n = track.length
  const d = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) d[i] = (track[i+1][1]-track[i][1]) / (track[i+1][0]-track[i][0])
  const m = new Array(n)
  m[0] = d[0]
  m[n-1] = d[n-2]
  for (let i = 1; i < n - 1; i++) m[i] = (d[i-1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i+1] = 0; continue }
    const a = m[i] / d[i], b = m[i+1] / d[i]
    const s = a*a + b*b
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau*a*d[i]; m[i+1] = tau*b*d[i] }
  }
  return m
}

function spline(track, p) {
  const m = tangents(track)
  if (p <= track[0][0]) return track[0][1]
  const last = track[track.length-1]
  if (p >= last[0]) return last[1]
  for (let i = 0; i < track.length - 1; i++) {
    const [x0,y0] = track[i], [x1,y1] = track[i+1]
    if (p >= x0 && p <= x1) {
      const h = x1 - x0, t = (p - x0) / h, t2 = t*t, t3 = t2*t
      return (2*t3-3*t2+1)*y0 + (t3-2*t2+t)*h*m[i] + (-2*t3+3*t2)*y1 + (t3-t2)*h*m[i+1]
    }
  }
  return last[1]
}

const H = 1e-4
const vel = (f,p) => Math.abs(f(CAMERA_Z, p+H) - f(CAMERA_Z, p-H)) / (2*H)

console.log('   p    per-segment-ease   PCHIP spline')
let maxA = 0, maxB = 0
for (let p = 0.24; p <= 0.72001; p += 0.02) {
  const a = vel(perSegmentEase, p), b = vel(spline, p)
  maxA = Math.max(maxA, a); maxB = Math.max(maxB, b)
  const node = CAMERA_Z.some(([np]) => Math.abs(np - p) < 0.011)
  console.log(`  ${p.toFixed(2)}  ${a.toFixed(2).padStart(8)}          ${b.toFixed(2).padStart(6)}${node ? '   <- KEYFRAME' : ''}`)
}
console.log(`\npeak |dz/dp|:  per-segment ${maxA.toFixed(1)}   spline ${maxB.toFixed(1)}   -> ${(maxA/maxB).toFixed(1)}x calmer`)
console.log('\nkeyframe values preserved by the spline (choreography unchanged):')
for (const [p, z] of CAMERA_Z) console.log(`  p=${p}  target z=${z}  spline=${spline(CAMERA_Z,p).toFixed(4)}`)
const vals = []
for (let p = 0; p <= 1; p += 0.005) vals.push(spline(CAMERA_Z, p))
let monotoneBreaks = 0
for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i-1] + 1e-9) monotoneBreaks++
console.log(`\novershoot check: ${monotoneBreaks} samples where z increases (must be 0 - the camera must never back out)`)
