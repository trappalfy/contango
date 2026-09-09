/**
 * Isolates the CPU cost of the filament rebuild from any GPU cost.
 * Mirrors Filament.tsx: CatmullRom curve -> TubeGeometry -> aProgress attribute.
 */
import * as THREE from 'three'

const TUBULAR = 220
const RADIAL = 6
const RADIUS = 0.006
const CONTROL = 9
const CURVE_RADIUS = 1.03

function buildCurve(time) {
  const pts = []
  for (let k = 0; k < CONTROL; k++) {
    const theta = (k / CONTROL) * Math.PI * 2
    const phi = Math.PI / 2 + Math.sin(theta * 2 + time * 0.18) * 0.45
    pts.push(
      new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * CURVE_RADIUS,
        Math.cos(phi) * CURVE_RADIUS,
        Math.sin(phi) * Math.sin(theta) * CURVE_RADIUS,
      ),
    )
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
}

function buildGeometry(time) {
  const geo = new THREE.TubeGeometry(buildCurve(time), TUBULAR, RADIUS, RADIAL, true)
  const perRing = RADIAL + 1
  const count = geo.attributes.position.count
  const progress = new Float32Array(count)
  for (let i = 0; i < count; i++) progress[i] = Math.floor(i / perRing) / TUBULAR
  geo.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
  return geo
}

// warm up
for (let i = 0; i < 30; i++) buildGeometry(i * 0.1).dispose()

const N = 300
const times = []
for (let i = 0; i < N; i++) {
  const t0 = performance.now()
  const g = buildGeometry(i * 0.1)
  times.push(performance.now() - t0)
  g.dispose()
}

times.sort((a, b) => a - b)
const mean = times.reduce((a, b) => a + b, 0) / times.length
const vertsPerBuild = (TUBULAR + 1) * (RADIAL + 1)
// position + normal (3+3 floats), uv (2), aProgress (1) = 9 floats
const bytesPerBuild = vertsPerBuild * 9 * 4

console.log(`buildGeometry(): mean=${mean.toFixed(2)}ms  p50=${times[150].toFixed(2)}  p95=${times[285].toFixed(2)}  max=${times[N - 1].toFixed(2)}`)
console.log(`vertices/build = ${vertsPerBuild}, ~${(bytesPerBuild / 1024).toFixed(0)} KB of attributes per build`)
console.log(`at 10 rebuilds/sec: ${(mean * 10).toFixed(1)} ms/sec of CPU (${((mean * 10) / 10).toFixed(2)}% of a 16.7ms frame budget per rebuild frame)`)
console.log(`garbage: ~${((bytesPerBuild * 10) / 1024).toFixed(0)} KB/sec`)
console.log(`cost as share of one 16.7ms frame: ${((mean / 16.7) * 100).toFixed(1)}%`)
