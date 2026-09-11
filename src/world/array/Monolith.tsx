'use client'

import { RoundedBox } from '@react-three/drei'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'

/**
 * One black slab.
 *
 * Near-black and only faintly reflective — in the reference frames these read
 * almost entirely as silhouette, and the small amount of specular along the
 * lit edge is the only thing telling you they are solid rather than holes cut
 * out of the sky. The bevel exists to catch exactly that highlight.
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
  /** 0 to 1. Hover/focus rim lift for the interactive section monoliths. */
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth } = placement

  return (
    <RoundedBox
      args={[width, height, depth]}
      radius={Math.min(0.28, width * 0.05)}
      smoothness={3}
      position={position}
      rotation={[0, rotationY, 0]}
      castShadow
      onPointerOver={
        onPointerOver &&
        ((e) => {
          e.stopPropagation()
          onPointerOver()
        })
      }
      onPointerOut={onPointerOut && (() => onPointerOut())}
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation()
          onClick()
        })
      }
    >
      <meshStandardMaterial
        color={palette.monolith}
        roughness={0.74 - emphasis * 0.26}
        metalness={0.06 + emphasis * 0.3}
        emissive={palette.sunColor}
        emissiveIntensity={emphasis * 0.055}
      />
    </RoundedBox>
  )
}
