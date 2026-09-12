'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, MathUtils, RepeatWrapping, type Mesh, type Texture } from 'three'
import type { Palette } from '../atmosphere/palette'
import { voussoir as voussoirGeometry } from '../geometry/arch'

/**
 * The aperture — the threshold to World 2.
 *
 * Built as a real arch, because the previous torus read as a hoop: something
 * bent, not something constructed. What makes masonry legible is seeing HOW it
 * was assembled, so this is built the way an arch actually is:
 *
 *  - VOUSSOIRS. A ring of wedge-shaped blocks, each cut to the arc, with a
 *    gap of shadow at every joint. The joints are the detail — a smooth ring
 *    of stone reads as poured, a jointed one as quarried and set.
 *  - CONCENTRIC ORDERS. Inside the outer ring, narrower rings step BACK into
 *    the opening, so the bore has depth and reads as a passage rather than a
 *    hole. This is where the machined character lives: the inner orders are
 *    finer, tighter and darker than the stone around them.
 *  - PLINTHS. Stepped masonry carrying it into the water, so it stands rather
 *    than balances.
 */
export function Aperture({
  palette,
  stone,
  radius = 42,
  charge = 0,
}: {
  palette: Palette
  /** Shared limestone normal map, loaded once by ArrayWorld. */
  stone?: Texture
  radius?: number
  /** 0 to 1 while the visitor holds to enter. */
  charge?: number
}) {
  const glow = useRef<Mesh>(null)
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const map = useMemo(() => {
    if (!stone) return null
    const t = stone.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(2, 2)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  /** Wedge blocks around the outer ring. */
  // FEWER, BIGGER blocks.
  //
  // 26 thin wedges read as gear teeth, not as masonry. A real arch of this
  // span is built from a modest number of very large stones, and it is their
  // SIZE — and the black joint beside each one — that says quarried and set.
  const VOUSSOIRS = 17
  const blockDepth = radius * 0.34
  const blockThickness = radius * 0.36

  const voussoirs = useMemo(() => {
    const step = (Math.PI * 2) / VOUSSOIRS
    // The joint. Wide enough to throw a real shadow line between stones.
    const joint = step * 0.11
    const innerR = radius - blockThickness / 2
    const outerR = radius + blockThickness / 2
    return Array.from({ length: VOUSSOIRS }, (_, i) =>
      voussoirGeometry(innerR, outerR, i * step + joint / 2, step - joint, blockDepth),
    )
  }, [radius, blockThickness, blockDepth])

  /**
   * Concentric orders stepping back into the bore.
   *
   * Each is narrower and set further into the opening than the last, so the
   * eye reads depth. The innermost are dark and fine — the mechanism.
   */
  const orders = useMemo(
    () =>
      /*
       * Orders must recede, not stack.
       *
       * Evenly spaced and barely stepped back, these rendered as concentric
       * circles seen flat on — a bullseye. Depth is the whole point: each
       * order sits only slightly inside the last but MUCH further back, so
       * from the front they overlap into a bore you look down rather than
       * rings you look at.
       */
      [0, 1, 2, 3].map((i) => {
        const t = (i + 1) / 4
        return {
          r: radius * (1 - t * 0.2),
          tube: blockThickness * (0.3 - i * 0.05),
          z: -blockDepth * (0.6 + i * 1.15),
          machined: i >= 2,
        }
      }),
    [radius, blockThickness, blockDepth],
  )

  useFrame(({ clock }) => {
    const mat = glow.current?.material as { opacity: number } | undefined
    if (!mat) return
    const t = clock.elapsedTime
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.45 + charge * 6))
    mat.opacity = MathUtils.lerp(mat.opacity, 0.03 + pulse * 0.035 + charge * 0.5, 0.08)
  })

  const stoneProps = {
    color: palette.monolith,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.4,
    normalMap: map,
  }

  return (
    <group position={[0, radius * 1.06, -150]}>
      {/* Outer ring of voussoirs — true arc segments, not boxes. */}
      {voussoirs.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial {...stoneProps} />
        </mesh>
      ))}

      {/* Concentric orders receding into the opening. */}
      {orders.map((o, i) => (
        <mesh key={`ord-${i}`} position={[0, 0, o.z]}>
          <torusGeometry args={[o.r, o.tube, o.machined ? 10 : 6, 88]} />
          <meshStandardMaterial
            color={palette.monolith}
            roughness={o.machined ? 0.42 : 0.8}
            metalness={o.machined ? 0.55 : 0}
            envMapIntensity={o.machined ? 0.9 : 0.4}
            normalMap={o.machined ? null : map}
          />
        </mesh>
      ))}

      {/* The membrane, set deep in the bore. */}
      <mesh ref={glow} position={[0, 0, -blockDepth * 2.6]}>
        <circleGeometry args={[radius * 0.36, 72]} />
        <meshBasicMaterial
          color={palette.sunColor}
          transparent
          opacity={0.04}
          toneMapped={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Stepped plinths carrying the arch into the water. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * radius * 0.78, -radius * 0.72, 0]}>
          {[0, 1, 2].map((step) => {
            const w = radius * (0.3 + step * 0.13)
            const h = radius * 0.2
            return (
              <mesh key={step} position={[s * step * radius * 0.05, -step * h, 0]}>
                <boxGeometry args={[w, h, blockDepth * (1.5 + step * 0.4)]} />
                <meshStandardMaterial {...stoneProps} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}
