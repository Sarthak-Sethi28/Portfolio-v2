'use client'

import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { concreteTiled } from '../materials/concrete'

/**
 * One slab.
 *
 * Near-black and barely reflective — in the reference frames these read almost
 * entirely as silhouette, and the thin specular along the lit edge is the only
 * thing telling you they are solid rather than holes cut out of the sky. The
 * bevel exists to catch exactly that highlight, and the concrete map gives it
 * something to catch ON, so the edge breaks up instead of running dead straight.
 *
 * The optional shoulder is rendered as a second mass butted against one face,
 * which is what turns a rectangle into a silhouette worth looking at.
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
  const { position, rotationY, width, height, depth, shoulder } = placement
  // Tiling scaled to world size, so a short slab and a tall one share the same
  // aggregate grain instead of one looking like a scaled photo of the other.
  const map = useMemo(() => concreteTiled(width / 9, height / 9), [width, height])
  const shoulderMap = useMemo(
    () =>
      shoulder
        ? concreteTiled((width * shoulder.width) / 9, (height * shoulder.height) / 9)
        : null,
    [width, height, shoulder],
  )

  const material = (tex: typeof map) => (
    <meshStandardMaterial
      color={palette.monolith}
      roughness={0.86 - emphasis * 0.22}
      metalness={0.04 + emphasis * 0.24}
      roughnessMap={tex}
      // No bumpMap. A perturbed normal under a near-horizontal key light
      // aliases into specular glitter across the whole face — the surface
      // variation has to come from roughness alone, which does not move the
      // normal and therefore cannot sparkle.
      emissive={palette.sunColor}
      emissiveIntensity={emphasis * 0.05}
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

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[width, height, depth]}
        radius={Math.min(0.3, width * 0.05)}
        smoothness={3}
        {...handlers}
      >
        {material(map)}
      </RoundedBox>

      {shoulder && (
        <RoundedBox
          args={[width * shoulder.width, height * shoulder.height, depth * 0.94]}
          radius={Math.min(0.26, width * 0.045)}
          smoothness={3}
          // Butted against one face and sitting on the same ground plane, so
          // the step reads as one poured mass rather than two stacked objects.
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
