'use client'

import { useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type MeshStandardMaterial } from 'three'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { concreteTiled } from '../materials/concrete'
import { useScene } from '@/store/scene'

/**
 * One pier.
 *
 * These were extruded boxes with a texture on them, and no amount of surface
 * detail fixes that — what gives real architecture its definition is GEOMETRIC
 * DEPTH. A pier of this kind is not a solid block; it is a frame:
 *
 *   - four CORNER PILASTERS standing proud of the faces
 *   - the field between them RECESSED, so every face carries a deep panel
 *   - STRING COURSES banding horizontally between the pilasters, dividing the
 *     shaft into storeys
 *   - a stepped CORNICE oversailing the top, and a spreading PLINTH at the base
 *
 * Every one of those throws a real shadow that moves as the light and camera
 * move. That is the difference between something modelled and something
 * printed on a slab, and it is why the reference reads as built.
 */
export function Monolith({
  placement,
  palette,
  emphasis = 0,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  placement: Placement
  palette: Palette
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth, shoulder, detail } = placement
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const noTex = useScene((s) => s.flags.noTex)

  const map = useMemo(() => concreteTiled(width / 11, maxAniso), [width, maxAniso])

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)

  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 7, delta)
    const e = eased.current
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = e * 0.14
      m.roughness = 0.86 - e * 0.16
      m.envMapIntensity = 0.35 + e * 0.25
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const mat = (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      roughness={0.86}
      metalness={0}
      envMapIntensity={0.35}
      roughnessMap={noTex ? null : map}
      emissive={palette.sunColor}
      emissiveIntensity={0}
    />
  )

  const handlers = {
    onPointerOver:
      onPointerOver &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onPointerOver()
      }),
    onPointerOut: onPointerOut && (() => onPointerOut()),
    onClick:
      onClick &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onClick()
      }),
  }

  // Proportions of the order. The pilaster is a fraction of the face, and the
  // recessed core sits back behind it — that setback is the whole effect.
  const pil = Math.min(width, depth) * 0.17
  const setback = pil * 0.55
  const coreW = width - setback * 2
  const coreD = depth - setback * 2
  const bevel = Math.min(0.22, width * 0.035)

  // String courses divide the shaft into storeys.
  const courses = useMemo(() => {
    const n = Math.max(1, detail.reveals)
    return Array.from({ length: n }, (_, i) => height * ((i + 1) / (n + 1)) - height / 2)
  }, [detail.reveals, height])

  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Recessed core. Set back on all four sides so each face reads as a
          deep panel rather than a flat side. */}
      <mesh {...handlers}>
        <boxGeometry args={[coreW, height, coreD]} />
        {mat}
      </mesh>

      {/* Corner pilasters, standing proud the full height. */}
      {corners.map(([sx, sz], i) => (
        <RoundedBox
          key={`pil-${i}`}
          args={[pil, height, pil]}
          radius={bevel}
          smoothness={2}
          position={[(sx * (width - pil)) / 2, 0, (sz * (depth - pil)) / 2]}
          {...handlers}
        >
          {mat}
        </RoundedBox>
      ))}

      {/* String courses banding between the pilasters. Proud of the core but
          shy of the pilasters, so they read as a moulding, not a collar. */}
      {courses.map((y, i) => (
        <mesh key={`course-${i}`} position={[0, y, 0]} {...handlers}>
          <boxGeometry args={[width - pil * 0.5, height * 0.022, depth - pil * 0.5]} />
          {mat}
        </mesh>
      ))}

      {/* Cornice, in two steps. A single slab reads as a lid; two reads as
          a moulding. */}
      {detail.cornice > 0 && (
        <group position={[0, height / 2, 0]}>
          <mesh position={[0, -height * 0.026, 0]} {...handlers}>
            <boxGeometry
              args={[width * (1 + detail.cornice * 0.6), height * 0.02, depth * (1 + detail.cornice * 0.6)]}
            />
            {mat}
          </mesh>
          <mesh position={[0, -height * 0.008, 0]} {...handlers}>
            <boxGeometry
              args={[width * (1 + detail.cornice * 1.5), height * 0.018, depth * (1 + detail.cornice * 1.5)]}
            />
            {mat}
          </mesh>
        </group>
      )}

      {/* Plinth where the pier meets the water. */}
      {detail.plinth > 0 && (
        <group position={[0, -height / 2, 0]}>
          <mesh position={[0, height * 0.016, 0]} {...handlers}>
            <boxGeometry
              args={[width * (1 + detail.plinth * 1.4), height * 0.032, depth * (1 + detail.plinth * 1.4)]}
            />
            {mat}
          </mesh>
          <mesh position={[0, height * 0.042, 0]} {...handlers}>
            <boxGeometry
              args={[width * (1 + detail.plinth * 0.6), height * 0.02, depth * (1 + detail.plinth * 0.6)]}
            />
            {mat}
          </mesh>
        </group>
      )}

      {shoulder && (
        <RoundedBox
          args={[width * shoulder.width, height * shoulder.height, depth * 0.94]}
          radius={bevel}
          smoothness={2}
          position={[
            (shoulder.side * (width + width * shoulder.width)) / 2 - shoulder.side * 0.35,
            (height * shoulder.height - height) / 2,
            0,
          ]}
          {...handlers}
        >
          {mat}
        </RoundedBox>
      )}
    </group>
  )
}
