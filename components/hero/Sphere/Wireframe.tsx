'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { SCENE, C } from '@/lib/hero.tokens'
import { simplex3 } from '@/lib/simplex'

/**
 * §9.3 — the crumpled polyhedron. Visible from outside as a faint cage and
 * from inside as the large mesh that fills the frame after the pass-through.
 */
export function Wireframe() {
  const geometry = useMemo(() => {
    const base = new THREE.IcosahedronGeometry(SCENE.wireRadius, SCENE.wireDetail)

    // Push every vertex along its own radius by noise, so the silhouette reads
    // as faceted and slightly dented rather than as a perfect sphere.
    // Displacement is a pure function of position, so vertices shared between
    // faces stay welded and EdgesGeometry can still find the shared edges.
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
  }, [])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(C.wire),
        transparent: true,
        opacity: SCENE.wireOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />
}
