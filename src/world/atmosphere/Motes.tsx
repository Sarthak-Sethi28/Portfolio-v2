'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import type { Palette } from './palette'

/**
 * Dust suspended in the low sun.
 *
 * Cheap, and it does something no static image can: it proves the scene is
 * alive during the long still moments when the camera is barely drifting.
 * Seeded, so two runs place identical motes and visual tests stay meaningful.
 */
export function Motes({
  count,
  palette,
  radius = 120,
}: {
  count: number
  palette: Palette
  radius?: number
}) {
  const ref = useRef<Points>(null)

  const { geometry, speeds } = useMemo(() => {
    const rng = createRng(SEED.motes)
    const positions = new Float32Array(count * 3)
    const drift = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = range(rng, -radius, radius)
      // Weighted low — dust hangs near the ground where the light rakes it.
      positions[i * 3 + 1] = Math.pow(rng(), 1.8) * 46 + 0.4
      positions[i * 3 + 2] = range(rng, -radius, radius)
      drift[i] = range(rng, 0.12, 0.55)
    }

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return { geometry: g, speeds: drift }
  }, [count, radius])

  useFrame((_, delta) => {
    const pts = ref.current
    if (!pts) return
    const attr = pts.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i < count; i++) {
      arr[i * 3] += speeds[i] * delta * 1.6
      arr[i * 3 + 1] += speeds[i] * delta * 0.32
      // Wrap rather than respawn, so density stays exactly constant.
      if (arr[i * 3] > radius) arr[i * 3] = -radius
      if (arr[i * 3 + 1] > 48) arr[i * 3 + 1] = 0.4
    }
    attr.needsUpdate = true
  })

  if (count === 0) return null

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.11}
        sizeAttenuation
        color={palette.sunColor}
        transparent
        opacity={0.22}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
