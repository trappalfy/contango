'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { C, INSIDE_FADE, SCENE, sampleSpline } from '@/lib/hero.tokens'
import { scrollState } from '@/lib/useScrollProgress'
import { pointsVert } from '../shaders/points.vert'
import { pointsFrag } from '../shaders/points.frag'

/** Deterministic PRNG so the cloud is identical across reloads and HMR. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * §9.2 — Fibonacci sphere with a radial jitter, drawn as one additive
 * THREE.Points. The magenta band comes from the shader, not from a second
 * draw call.
 */
export function Points({ count }: { count: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.gl.getPixelRatio())

  const { positions, seeds, sizes } = useMemo(() => {
    const rand = mulberry32(0x5eed)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Golden-angle spiral: even coverage without a visible pole cluster.
      const y = 1 - (i / (count - 1)) * 2
      const ring = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = GOLDEN_ANGLE * i

      // Jitter breaks up the regular spiral, which is otherwise obvious.
      const r = SCENE.sphereRadius + (rand() * 2 - 1) * SCENE.pointJitter

      positions[i * 3 + 0] = Math.cos(theta) * ring * r
      positions[i * 3 + 1] = y * r
      positions[i * 3 + 2] = Math.sin(theta) * ring * r

      seeds[i] = rand()
      sizes[i] = 0.6 + rand() * 0.4
    }

    return { positions, seeds, sizes }
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      // Fixed in object space: because the whole group rotates, the band then
      // occupies one sector of the sphere and travels with it, which is what
      // acceptance criterion 5 asks for. Rotating it here as well would slide
      // it across the surface at double speed.
      uBandAxis: { value: new THREE.Vector3(1, 0.25, 0.6).normalize() },
      uCold: { value: new THREE.Color(C.particleCold) },
      uHot: { value: new THREE.Color(C.particleHot) },
      uDeep: { value: new THREE.Color(C.particleDeep) },
      uInside: { value: 0 },
    }),
    [pixelRatio],
  )

  useFrame((_, dt) => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uTime.value += dt
    mat.uniforms.uInside.value = sampleSpline(INSIDE_FADE, scrollState.smooth)
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={pointsVert}
        fragmentShader={pointsFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
