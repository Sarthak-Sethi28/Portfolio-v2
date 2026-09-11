'use client'

import { useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, MathUtils, Vector2, type MeshStandardMaterial } from 'three'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { concreteMapsTiled, type ConcreteMaps } from '../materials/concrete'
import { useScene } from '@/store/scene'

/**
 * One cast-concrete mass.
 *
 * Hero monoliths get a real facade vocabulary rather than being a rounded box
 * with a texture: a framed recessed bay, deep cornice/plinth, formwork reveals
 * and true normal detail. Decorative field masses stay cheaper so the visual
 * upgrade does not trade the old shimmer for frame-time judder.
 */
export function Monolith({
  placement,
  palette,
  hero = false,
  emphasis = 0,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  placement: Placement
  palette: Palette
  /** Rich geometry is reserved for the four interactive foreground masses. */
  hero?: boolean
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth, shoulder, detail } = placement
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const noTex = useScene((s) => s.flags.noTex)

  const maps = useMemo(
    () => concreteMapsTiled(Math.max(1, width / 8.5), maxAniso),
    [width, maxAniso],
  )
  const shoulderMaps = useMemo(
    () =>
      shoulder
        ? concreteMapsTiled(Math.max(1, (width * shoulder.width) / 8.5), maxAniso)
        : null,
    [width, shoulder, maxAniso],
  )
  const normalScale = useMemo(() => new Vector2(0.42, 0.42), [])

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)

  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 6, delta)
    const e = eased.current
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = e * 0.055
      m.roughness = 0.9 - e * 0.045
      m.envMapIntensity = 0.62 + e * 0.12
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const material = (tex: ConcreteMaps) => (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      map={noTex ? null : tex.albedo}
      roughness={0.9}
      roughnessMap={noTex ? null : tex.roughness}
      normalMap={noTex ? null : tex.normal}
      normalScale={normalScale}
      metalness={0}
      envMapIntensity={0.62}
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

  const bevel = Math.min(0.36, width * 0.035)

  const reveals = useMemo(() => {
    if (detail.reveals <= 0) return []
    return Array.from({ length: detail.reveals }, (_, i) => {
      const f = (i + 1) / (detail.reveals + 1)
      return { y: height * f - height / 2, thickness: Math.max(0.09, height * 0.009) }
    })
  }, [detail.reveals, height])

  // Foreground facade proportions. The frame is real geometry, so it creates
  // parallax and shadow instead of relying on a painted line in a texture.
  const panelW = width * 0.62
  const panelH = height * 0.56
  const rail = Math.min(1.15, Math.max(0.42, width * 0.055))
  const frameDepth = Math.min(0.24, Math.max(0.1, depth * 0.012))
  const recessDepth = 0.035

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[width, height, depth]}
        radius={bevel}
        smoothness={4}
        castShadow={hero}
        receiveShadow
        {...handlers}
      >
        {material(maps)}
      </RoundedBox>

      {/* A heavier, layered cap catches the sky and gives the silhouette a
          crafted edge rather than the single lip of a primitive box. */}
      {detail.cornice > 0 && (
        <>
          <RoundedBox
            args={[
              width * (1 + detail.cornice * 1.35),
              Math.max(0.55, height * 0.038),
              depth * (1 + detail.cornice * 1.2),
            ]}
            radius={bevel * 0.55}
            smoothness={3}
            position={[0, height / 2 - height * 0.019, 0]}
            castShadow={hero}
            receiveShadow
            {...handlers}
          >
            {material(maps)}
          </RoundedBox>
          {hero && (
            <RoundedBox
              args={[width * 1.035, Math.max(0.32, height * 0.018), depth * 1.035]}
              radius={bevel * 0.35}
              smoothness={2}
              position={[0, height / 2 - height * 0.055, 0]}
              castShadow
              receiveShadow
            >
              {material(maps)}
            </RoundedBox>
          )}
        </>
      )}

      {detail.plinth > 0 && (
        <RoundedBox
          args={[width * (1 + detail.plinth), height * 0.055, depth * (1 + detail.plinth)]}
          radius={bevel * 0.45}
          smoothness={3}
          position={[0, -height / 2 + height * 0.0275, 0]}
          castShadow={hero}
          receiveShadow
          {...handlers}
        >
          {material(maps)}
        </RoundedBox>
      )}

      {/* Formwork lift lines are geometry, not dark stripes. */}
      {reveals.map((r, i) => (
        <mesh key={`reveal-${i}`} position={[0, r.y, 0]} castShadow={hero} receiveShadow>
          <boxGeometry args={[width * 1.004, r.thickness, depth * 1.004]} />
          {material(maps)}
        </mesh>
      ))}

      {/* Hero facade: a deep framed bay on both broad faces. This is still
          brutalist, but now the close pillar has the same hierarchy of large,
          medium and micro detail that makes the reference architecture read as
          high resolution. */}
      {hero &&
        ([-1, 1] as const).map((side) => {
          const z = side * (depth / 2 + frameDepth / 2 + 0.015)
          const recessZ = side * (depth / 2 + recessDepth / 2 + 0.009)
          return (
            <group key={`facade-${side}`}>
              {/* dark inner bay */}
              <mesh position={[0, 0, recessZ]} castShadow receiveShadow>
                <boxGeometry args={[panelW - rail * 1.55, panelH - rail * 1.55, recessDepth]} />
                <meshStandardMaterial
                  color="#171b1b"
                  roughness={0.96}
                  metalness={0}
                  side={DoubleSide}
                  envMapIntensity={0.22}
                />
              </mesh>

              {/* vertical frame rails */}
              {[-1, 1].map((sx) => (
                <RoundedBox
                  key={`v-${sx}`}
                  args={[rail, panelH, frameDepth]}
                  radius={Math.min(0.12, rail * 0.18)}
                  smoothness={2}
                  position={[sx * (panelW / 2 - rail / 2), 0, z]}
                  castShadow
                  receiveShadow
                >
                  {material(maps)}
                </RoundedBox>
              ))}

              {/* horizontal frame rails */}
              {[-1, 1].map((sy) => (
                <RoundedBox
                  key={`h-${sy}`}
                  args={[panelW, rail, frameDepth]}
                  radius={Math.min(0.12, rail * 0.18)}
                  smoothness={2}
                  position={[0, sy * (panelH / 2 - rail / 2), z]}
                  castShadow
                  receiveShadow
                >
                  {material(maps)}
                </RoundedBox>
              ))}

              {/* structural mullions break the giant blank centre without
                  turning the slab into decorative gothic architecture. */}
              {[-0.23, 0.23].map((x, i) => (
                <RoundedBox
                  key={`m-${i}`}
                  args={[Math.max(0.22, rail * 0.38), panelH * 0.72, frameDepth * 0.72]}
                  radius={0.045}
                  smoothness={2}
                  position={[panelW * x, 0, side * (depth / 2 + frameDepth * 0.78)]}
                  castShadow
                  receiveShadow
                >
                  {material(maps)}
                </RoundedBox>
              ))}
            </group>
          )
        })}

      {shoulder && (
        <RoundedBox
          args={[width * shoulder.width, height * shoulder.height, depth * 0.94]}
          radius={Math.min(0.3, width * 0.038)}
          smoothness={4}
          position={[
            (shoulder.side * (width + width * shoulder.width)) / 2 - shoulder.side * 0.35,
            (height * shoulder.height - height) / 2,
            0,
          ]}
          castShadow={hero}
          receiveShadow
          {...handlers}
        >
          {material(shoulderMaps ?? maps)}
        </RoundedBox>
      )}
    </group>
  )
}
