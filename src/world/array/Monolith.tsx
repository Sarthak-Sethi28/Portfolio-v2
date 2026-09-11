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
 * One slab.
 *
 * Near-black and barely reflective — in the reference frames these read almost
 * entirely as silhouette, and the thin specular along the lit edge is the only
 * thing telling you they are solid rather than holes cut out of the sky.
 *
 * Two things give them architecture rather than primitive-ness: the stepped
 * shoulder, and the cornice / plinth / reveal vocabulary of cast concrete.
 * All of it is silhouette-level, because that is how these are seen.
 *
 * The hover highlight is EASED, never snapped. Raycasting resolves against the
 * camera, so while the camera drifts the object under a stationary cursor
 * changes repeatedly and the hover state flips on and off. Applied instantly
 * that flip is a visible jump in the material — which is very probably the
 * flicker that only ever appeared with camera motion. Damping makes the state
 * change unobservable even when it oscillates.
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
  /** 0 or 1. Target, not the applied value — see the easing note above. */
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth, shoulder, detail } = placement
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const noTex = useScene((s) => s.flags.noTex)

  // Horizontal tiling only; the vertical axis runs once so the waterline
  // stain sits at the base instead of repeating up the shaft.
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
      m.emissiveIntensity = e * 0.14
      m.roughness = 0.86 - e * 0.16
      m.envMapIntensity = 0.35 + e * 0.25
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const material = (tex: typeof map) => (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      roughness={0.86}
      // Concrete is a dielectric: its metalness is zero, not nearly zero.
      // Any metalness at all makes the face mirror the environment map, and
      // that reflection changes with every camera move — correct physics, but
      // another thing that can only ever shimmer while the view is moving.
      metalness={0}
      // The environment still lights these; it just does not mirror in them.
      envMapIntensity={0.35}
      roughnessMap={noTex ? null : tex}
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

  // Reveals: recessed horizontal bands where one lift of formwork met the next.
  const reveals = useMemo(() => {
    if (detail.reveals <= 0) return []
    return Array.from({ length: detail.reveals }, (_, i) => {
      const f = (i + 1) / (detail.reveals + 1)
      return { y: height * f - height / 2, thickness: height * 0.012 }
    })
  }, [detail.reveals, height])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[width, height, depth]} radius={bevel} smoothness={3} {...handlers}>
        {material(map)}
      </RoundedBox>

      {/* Cornice: a cap oversailing the shaft. Reads instantly as built. */}
      {detail.cornice > 0 && (
        <RoundedBox
          args={[width * (1 + detail.cornice), height * 0.035, depth * (1 + detail.cornice)]}
          radius={bevel * 0.5}
          smoothness={3}
          position={[0, height / 2 - height * 0.0175, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {/* Plinth: the base spreading where it meets the water. */}
      {detail.plinth > 0 && (
        <RoundedBox
          args={[width * (1 + detail.plinth), height * 0.05, depth * (1 + detail.plinth)]}
          radius={bevel * 0.5}
          smoothness={3}
          position={[0, -height / 2 + height * 0.025, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {/* Reveals, inset slightly so they catch a shadow line. */}
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
          smoothness={3}
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
