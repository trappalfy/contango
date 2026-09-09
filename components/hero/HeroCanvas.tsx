'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import {
  BLOOM_INTENSITY,
  CAMERA_Z,
  SCENE,
  bloomScaleFor,
  dprFor,
  pointCountFor,
  sampleSpline,
} from '@/lib/hero.tokens'
import { scrollState } from '@/lib/useScrollProgress'
import { Points } from './Sphere/Points'
import { Wireframe } from './Sphere/Wireframe'
import { Filament } from './Sphere/Filament'
import { Rings } from './Sphere/Rings'

function Scene({ pointCount, bloomScale }: { pointCount: number; bloomScale: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const bloomRef = useRef<BloomEffect>(null)
  const camera = useThree((s) => s.camera)
  const clock = useRef(0)

  useFrame((_, dt) => {
    const p = scrollState.smooth
    const reduced = scrollState.reduced
    clock.current += dt

    // §10 — camera distance is a pure function of p, so reversing the scroll
    // plays the flythrough backwards exactly.
    camera.position.z = reduced ? CAMERA_Z[0][1] : sampleSpline(CAMERA_Z, p)

    // Rotation is independent of p and never stops.
    const group = groupRef.current
    if (group) {
      group.rotation.y += dt * (reduced ? SCENE.reducedRotationY : SCENE.rotationY)
      group.rotation.x = reduced
        ? 0
        : Math.sin(clock.current * SCENE.rotationXSpeed) * SCENE.rotationXAmp
    }

    if (bloomRef.current) {
      const base = reduced
        ? BLOOM_INTENSITY[0][1]
        : sampleSpline(BLOOM_INTENSITY, p)
      bloomRef.current.intensity = base * bloomScale
    }
  })

  return (
    <>
      <group ref={groupRef}>
        <Points count={pointCount} />
        <Wireframe />
        <Filament />
        <Rings />
      </group>

      <EffectComposer>
        <Bloom
          ref={bloomRef}
          intensity={0.9 * bloomScale}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.5}
          mipmapBlur
          radius={0.72}
        />
        <Vignette offset={0.32} darkness={0.62} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  )
}

/**
 * §9.1 — the renderer. Mounted client-side only; the copy above it is real DOM
 * rendered on the server, so the canvas never gates LCP.
 */
export default function HeroCanvas({ active }: { active: boolean }) {
  const [width, setWidth] = useState(1440)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const apply = () => setWidth(window.innerWidth)
    apply()
    setReady(true)
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  const pointCount = useMemo(() => pointCountFor(width), [width])
  const dpr = useMemo(() => dprFor(width), [width])
  const bloomScale = useMemo(() => bloomScaleFor(width), [width])

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: ready ? 1 : 0,
        transition: 'opacity 600ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <Canvas
        aria-hidden="true"
        // Rendering stops entirely once the pinned section leaves the viewport.
        frameloop={active ? 'always' : 'never'}
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{
          fov: SCENE.cameraFov,
          near: SCENE.cameraNear,
          far: SCENE.cameraFar,
          position: [0, 0, CAMERA_Z[0][1]],
        }}
        onCreated={({ gl }) => {
          // Tone mapping washes the magenta out (§9.1).
          gl.toneMapping = THREE.NoToneMapping
        }}
      >
        <Scene pointCount={pointCount} bloomScale={bloomScale} />
      </Canvas>
    </div>
  )
}
