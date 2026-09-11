'use client'

import { useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type MeshStandardMaterial } from 'three'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { concreteTiled } from '../materials/concrete'
import { useScene } from '@/store/scene'

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
  const shoulderMap = useMemo(
    () => (shoulder ? concreteTiled((width * shoulder.width) / 11, maxAniso) : null),
    [width, shoulder, maxAniso],
  )

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)

  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 7, delta)
    const e = eased.current
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = e * 0.08
      m.roughness = 0.84 - e * 0.1
      m.envMapIntensity = 0.5 + e * 0.2
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const material = (tex: typeof map) => (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      roughness={0.84}
      metalness={0}
      envMapIntensity={0.5}
      roughnessMap={noTex ? null : tex}
      // The procedural concrete previously only changed roughness, so the board
      // joints, aggregate and rain streaks disappeared on these near-black
      // faces. Reusing its low-frequency grayscale as a very shallow bump map
      // gives grazing light something physical to catch without adding noisy
      // high-frequency normal detail that would shimmer during camera motion.
      bumpMap={noTex ? null : tex}
      bumpScale={noTex ? 0 : 0.14}
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

  const bevel = Math.min(0.3, width * 0.05)

  const reveals = useMemo(() => {
    if (detail.reveals <= 0) return []
    return Array.from({ length: detail.reveals }, (_, i) => {
      const f = (i + 1) / (detail.reveals + 1)
      return { y: height * f - height / 2, thickness: height * 0.012 }
    })
  }, [detail.reveals, height])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[width, height, depth]} radius={bevel} smoothness={4} {...handlers}>
        {material(map)}
      </RoundedBox>

      {detail.cornice > 0 && (
        <RoundedBox
          args={[width * (1 + detail.cornice), height * 0.035, depth * (1 + detail.cornice)]}
          radius={bevel * 0.5}
          smoothness={4}
          position={[0, height / 2 - height * 0.0175, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {detail.plinth > 0 && (
        <RoundedBox
          args={[width * (1 + detail.plinth), height * 0.05, depth * (1 + detail.plinth)]}
          radius={bevel * 0.5}
          smoothness={4}
          position={[0, -height / 2 + height * 0.025, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {reveals.map((r, i) => (
        <mesh key={`reveal-${i}`} position={[0, r.y, 0]}>
          <boxGeometry args={[width * 0.985, r.thickness, depth * 0.985]} />
          {material(map)}
        </mesh>
      ))}

      {shoulder && (
        <RoundedBox
          args={[width * shoulder.width, height * shoulder.height, depth * 0.94]}
          radius={Math.min(0.26, width * 0.045)}
          smoothness={4}
          position={[
            (shoulder.side * (width + width * shoulder.width)) / 2 - shoulder.side * 0.35,
            (height * shoulder.height - height) / 2,
            0,
          ]}
          {...handlers}
        >
          {material(shoulderMap ?? map)}
        </RoundedBox>
      )}
    </group>
  )
}
