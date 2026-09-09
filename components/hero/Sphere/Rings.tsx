'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE, C } from '@/lib/hero.tokens'

function ringGeometry(radius: number): THREE.BufferGeometry {
  // Slightly elliptical — a true circle reads as a mechanical halo.
  const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.92, 0, Math.PI * 2, false, 0)
  const pts = curve.getPoints(192).map((p) => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.BufferGeometry().setFromPoints(pts)
}

/**
 * §9.5 — two barely-there orbital rings. They are almost invisible by design;
 * their job is to stop the sphere reading as a ball floating in nothing.
 */
export function Rings() {
  const groupRef = useRef<THREE.Group>(null)

  const rings = useMemo(
    () =>
      SCENE.ringRadii.map((radius, i) => ({
        geometry: ringGeometry(radius),
        tilt: SCENE.ringTilts[i],
      })),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(C.wire),
        transparent: true,
        opacity: SCENE.ringOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  useFrame((_, dt) => {
    // Deliberately slower than the sphere itself.
    if (groupRef.current) groupRef.current.rotation.y += dt * SCENE.rotationY * 0.4
  })

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <lineLoop
          key={i}
          geometry={ring.geometry}
          material={material}
          rotation={[Math.PI / 2 - ring.tilt, i * 0.7, 0]}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
