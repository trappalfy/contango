'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  SCENE,
  C,
  FILAMENT_OPACITY,
  sampleSpline,
  easeInOutCubic,
  clamp01,
} from '@/lib/hero.tokens'
import { simplex3 } from '@/lib/simplex'
import { scrollState } from '@/lib/useScrollProgress'

const filamentVert = /* glsl */ `
attribute float aProgress;
varying float vProgress;
void main() {
  vProgress = aProgress;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * The head is the brightest point and the tail falls off behind it. Working in
 * wrapped curve space rather than drawRange means the comet crosses the seam of
 * the closed loop without a visible jump.
 */
const filamentFrag = /* glsl */ `
uniform vec3  uColor;
uniform float uHead;
uniform float uWindow;
uniform float uOpacity;
varying float vProgress;

void main() {
  float d = uHead - vProgress;
  d = d - floor(d);
  float a = 1.0 - smoothstep(0.0, uWindow, d);
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`

const wrap01 = (v: number): number => ((v % 1) + 1) % 1

/** Interpolates around the loop the short way, so the head never jumps the seam. */
function mixWrapped(from: number, to: number, t: number): number {
  let delta = to - from
  delta -= Math.round(delta)
  return wrap01(from + delta * t)
}

/** Control points drift with noise, so the path never settles into one shape. */
function buildCurve(time: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  const n = SCENE.filamentControlPoints

  for (let k = 0; k < n; k++) {
    const u = k / n
    const theta = u * Math.PI * 2
    // A wavy band rather than points scattered over the whole sphere — that
    // keeps the tube lying on the surface instead of cutting through it.
    const phi =
      Math.PI / 2 +
      Math.sin(theta * 2 + time * 0.18) * 0.45 +
      simplex3(Math.cos(theta) * 1.3, Math.sin(theta) * 1.3, time * 0.12) * 0.35

    const r = SCENE.filamentRadius
    pts.push(
      new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        Math.cos(phi) * r,
        Math.sin(phi) * Math.sin(theta) * r,
      ),
    )
  }

  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
}

function buildGeometry(time: number): THREE.BufferGeometry {
  const geo = new THREE.TubeGeometry(
    buildCurve(time),
    SCENE.filamentTubularSegments,
    SCENE.filamentTubeRadius,
    SCENE.filamentRadialSegments,
    true,
  )

  // TubeGeometry lays vertices out as (tubularSegments + 1) rings of
  // (radialSegments + 1) vertices, so position along the curve is just the
  // ring index.
  const perRing = SCENE.filamentRadialSegments + 1
  const count = geo.attributes.position.count
  const progress = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    progress[i] = Math.floor(i / perRing) / SCENE.filamentTubularSegments
  }
  geo.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))

  return geo
}

/** §9.4 — the glowing thread. Bloom supplies the glow; there is no glow shader. */
export function Filament() {
  const meshRef = useRef<THREE.Mesh>(null)
  const elapsed = useRef(0)
  const sinceRebuild = useRef(0)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: filamentVert,
        fragmentShader: filamentFrag,
        uniforms: {
          uColor: { value: new THREE.Color(C.filament) },
          uHead: { value: 0 },
          uWindow: { value: SCENE.filamentWindow },
          uOpacity: { value: FILAMENT_OPACITY[0][1] },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  const initialGeometry = useMemo(() => buildGeometry(0), [])

  useEffect(() => {
    const mesh = meshRef.current
    return () => {
      // The live geometry is whatever the last rebuild installed on the mesh.
      mesh?.geometry.dispose()
      material.dispose()
    }
  }, [material])

  useFrame((_, dt) => {
    const mesh = meshRef.current
    if (!mesh) return

    const reduced = scrollState.reduced
    const p = scrollState.smooth
    if (!reduced) elapsed.current += dt

    // Head travels the loop once per filamentLoopSeconds.
    const free = (elapsed.current / SCENE.filamentLoopSeconds) % 1

    // Acceptance criterion 8 — the filament has to be the brightest object in
    // frame during the pass-through. Brightness alone does not achieve that:
    // a free-running crawl only puts the lit arc in front of the camera by
    // luck. Near p = 0.5 the head is eased toward the position that centres the
    // arc on the camera axis, with the group's own rotation taken back out
    // because the filament rides inside that group.
    // A point at curve parameter u sits at object azimuth (pi/2 - 2*pi*u) from
    // +Z; a group rotation of `a` about Y adds `a` to that. Solving for world
    // azimuth 0 gives u = 0.25 + a / 2pi.
    const rotY = mesh.parent ? mesh.parent.rotation.y : 0
    const facing = wrap01(0.25 + rotY / (Math.PI * 2))
    const target = wrap01(facing + SCENE.filamentWindow / 2)
    const bias = easeInOutCubic(clamp01(1 - Math.abs(p - 0.5) / 0.2))

    material.uniforms.uHead.value = reduced ? 0.25 : mixWrapped(free, target, bias)

    material.uniforms.uOpacity.value = sampleSpline(FILAMENT_OPACITY, p)

    // Rebuilding the tube is the expensive part, so it runs at ~10 Hz rather
    // than per frame; the drift is slow enough that this is not visible.
    if (!reduced) {
      sinceRebuild.current += dt
      if (sinceRebuild.current >= 0.1) {
        sinceRebuild.current = 0
        const previous = mesh.geometry
        mesh.geometry = buildGeometry(elapsed.current)
        previous.dispose()
      }
    }
  })

  return (
    <mesh ref={meshRef} geometry={initialGeometry} material={material} frustumCulled={false} />
  )
}
