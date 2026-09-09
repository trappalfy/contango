import * as THREE from 'three'
import { BloomEffect, EffectComposer, EffectPass, RenderPass, VignetteEffect } from 'postprocessing'
import { C, SCENE } from '@/lib/hero.tokens'
import { simplex3 } from '@/lib/simplex'
import { ROLLS, type WelcomeState } from './timeline'

/**
 * The film's three.js scene — §4 of contango-welcome-video-spec.md.
 *
 * Built imperatively rather than through react-three-fiber, because capture
 * needs to drive exactly one render per frame with no loop of its own.
 *
 * The sphere is the hero's, not an imitation: same `SCENE` constants, same
 * simplex displacement, same `EdgesGeometry` treatment. The construction is
 * restated here rather than imported because the hero builds it inside a React
 * component, and this file may not edit the public site to extract it.
 *
 * Palette is the project's, not the spec's §7 table — every colour below comes
 * from `C`.
 */

/** §4 — the film frames tighter than the site does. */
const FOV = 35

/** §4 — pink, and rare. This is an accent, not a starfield. */
const DUST_COUNT = 300
const DUST_SIZE_PX = 2

/** Ring radius at the sphere's surface, matched to the cage. */
const RING_RADIUS = SCENE.wireRadius
const RING_SEGMENTS = 160

export type Welcome = {
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  camera: THREE.PerspectiveCamera
  apply: (state: WelcomeState) => void
  render: () => void
  dispose: () => void
}

/** Deterministic in [0,1) — no Math.random anywhere in a captured frame. */
function rand(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * The hero's crumpled cage.
 *
 * Vertices are pushed along their own radius by noise, which is what stops the
 * silhouette reading as a perfect ball. Displacement is a pure function of
 * position, so shared vertices stay welded and `EdgesGeometry` can still find
 * the shared edges.
 */
function cageGeometry(): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(SCENE.wireRadius, SCENE.wireDetail)
  const pos = base.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = simplex3(v.x * 1.6, v.y * 1.6, v.z * 1.6)
    const scale = 1 + n * SCENE.wireNoiseAmp
    pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale)
  }
  pos.needsUpdate = true

  const edges = new THREE.EdgesGeometry(base, 1)
  base.dispose()
  return edges
}

/** One latitude ring, in the XZ plane at the height its latitude implies. */
function ringGeometry(latitude: number): THREE.BufferGeometry {
  const r = RING_RADIUS * Math.cos(latitude)
  const y = RING_RADIUS * Math.sin(latitude)
  const points: THREE.Vector3[] = []

  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }

  return new THREE.BufferGeometry().setFromPoints(points)
}

function dustGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(DUST_COUNT * 3)

  for (let i = 0; i < DUST_COUNT; i++) {
    // A slab around the spheres rather than a sphere of its own, so the dust
    // stays behind and beside the subject instead of enclosing it.
    positions[i * 3] = (rand(i * 3 + 1) - 0.5) * 9
    positions[i * 3 + 1] = (rand(i * 3 + 2) - 0.5) * 5
    positions[i * 3 + 2] = (rand(i * 3 + 3) - 0.5) * 6 - 1
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return g
}

export function createWelcome(canvas: HTMLCanvasElement, width: number, height: number): Welcome {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  })
  // §3 — pinned, or frames drift between machines.
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)
  // Tone mapping washes the magenta out, as it does on the site.
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, width / height, SCENE.cameraNear, SCENE.cameraFar)
  camera.position.set(0, 0, 2.6)
  camera.lookAt(0, 0, 0)

  const cage = cageGeometry()

  const cageMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(C.wire),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  /**
   * §4 — the left sphere neither gains nor loses anything.
   *
   * No glow, no growth, no thickening: any hint of accrual reads as a promise
   * of yield, which the account brief forbids outright. The whole argument is
   * carried by the asymmetry — one sheds its rings, the other is untouched.
   */
  const left = new THREE.Group()
  left.add(new THREE.LineSegments(cage, cageMaterial))
  scene.add(left)

  const right = new THREE.Group()
  right.add(new THREE.LineSegments(cage, cageMaterial))
  scene.add(right)

  // §4 — twelve rings, one per roll. Each owns its material so it can fade
  // independently of the other eleven.
  const ringGroup = new THREE.Group()
  const rings = Array.from({ length: ROLLS }, () => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(C.particleCold),
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const loop = new THREE.LineLoop(new THREE.BufferGeometry(), material)
    loop.frustumCulled = false
    ringGroup.add(loop)
    return { loop, material }
  })
  right.add(ringGroup)

  const dust = new THREE.Points(
    dustGeometry(),
    new THREE.PointsMaterial({
      color: new THREE.Color(C.particleDeep),
      size: DUST_SIZE_PX,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  scene.add(dust)

  // §4 / decision: bloom and vignette stay, noise does not — a random grain
  // would break the "two runs produce identical files" acceptance check.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(
    new EffectPass(
      camera,
      new BloomEffect({
        intensity: 0.9,
        luminanceThreshold: 0.15,
        luminanceSmoothing: 0.5,
        mipmapBlur: true,
        radius: 0.72,
      }),
      new VignetteEffect({ offset: 0.32, darkness: 0.62 }),
    ),
  )
  composer.setSize(width, height)

  /** Geometry is rebuilt only when a ring's radius actually changed. */
  const lastScale = new Float32Array(ROLLS).fill(-1)

  function apply(state: WelcomeState) {
    camera.position.set(state.camera.x, state.camera.y, state.camera.z)
    camera.lookAt(state.camera.x * 0.35, 0, 0)

    left.visible = state.sceneVisible
    right.visible = state.sceneVisible
    dust.visible = state.sceneVisible

    left.position.x = state.leftX
    right.position.x = state.rightX
    left.rotation.y = state.rotationY
    right.rotation.y = state.rotationY

    for (let i = 0; i < ROLLS; i++) {
      const r = state.rings[i]
      const { loop, material } = rings[i]

      loop.visible = r.visible
      if (!r.visible) continue

      if (lastScale[i] !== r.scale) {
        loop.geometry.dispose()
        loop.geometry = ringGeometry(r.latitude)
        loop.scale.setScalar(r.scale)
        lastScale[i] = r.scale
      }

      loop.position.x = r.offsetX
      material.opacity = r.opacity
    }
  }

  function render() {
    composer.render()
  }

  function dispose() {
    cage.dispose()
    cageMaterial.dispose()
    for (const r of rings) {
      r.loop.geometry.dispose()
      r.material.dispose()
    }
    dust.geometry.dispose()
    ;(dust.material as THREE.Material).dispose()
    composer.dispose()
    renderer.dispose()
  }

  return { renderer, composer, camera, apply, render, dispose }
}
