'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from 'three'
import { createRng, range, SEED } from '@/lib/rng'

/**
 * Silt rising through the water.
 *
 * The cheapest thing that says "you are underwater and everything is the wrong
 * way up". Dust in air falls; silt in water RISES, and the eye reads that
 * inversion before it consciously notices the architecture is hanging.
 *
 * Sparse and slow on purpose — heavy particulate reads as snow. Large enough
 * never to be sub-pixel, since additive points are the class of thing that
 * once gave this project a shimmer problem.
 */
export function Silt({ count = 260, radius = 200 }: { count?: number; radius?: number }) {
  const ref = useRef<Points>(null)

  const { geometry, speeds } = useMemo(() => {
    const rng = createRng(SEED.motes + 909)
    const positions = new Float32Array(count * 3)
    const rise = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = range(rng, -radius, radius)
      positions[i * 3 + 1] = range(rng, -180, 0)
      positions[i * 3 + 2] = range(rng, -radius, radius)
      rise[i] = range(rng, 0.9, 3.4)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return { geometry: g, speeds: rise }
  }, [count, radius])

  useFrame((_, delta) => {
    const pts = ref.current
    if (!pts) return
    const attr = pts.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta
      if (arr[i * 3 + 1] > 0) arr[i * 3 + 1] = -180
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.55}
        sizeAttenuation
        color="#9fc2d8"
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
