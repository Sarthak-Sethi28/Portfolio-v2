'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, MathUtils, RepeatWrapping, Vector2, type Mesh, type Texture } from 'three'
import type { Palette } from '../atmosphere/palette'
import { voussoir as voussoirGeometry } from '../geometry/arch'
import { createRng, range } from '@/lib/rng'

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

  /*
   * The orders need their OWN tiling.
   *
   * A torus carries 0-1 UVs wrapped around and through it, whereas
   * ExtrudeGeometry writes world coordinates. One texture instance cannot
   * serve both — at the blocks' repeat the rings came out glass-smooth, which
   * is why the bore still looked moulded after the voussoirs stopped.
   */
  const ringMap = useMemo(() => {
    if (!stone) return null
    const t = stone.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    // Many times around the ring, a few times through its section.
    t.repeat.set(26, 3)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  const map = useMemo(() => {
    if (!stone) return null
    const t = stone.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    /*
     * ExtrudeGeometry writes UVs in WORLD coordinates.
     *
     * The shape spans about 84 units across, so a repeat of 2 tiled the stone
     * roughly eighty times over each block — compressed into invisible noise,
     * which is why the arch read as smooth grey plastic however good the
     * texture was. A repeat near 1/9 puts one tile every nine world units,
     * which is the scale a hand-sized rock face actually is.
     */
    t.repeat.set(0.11, 0.11)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  // Strong relief. On a megalithic block the erosion is centimetres deep, and
  // a timid normal map is indistinguishable from none.
  const normalScale = useMemo(() => new Vector2(1.8, 1.8), [])

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
    /*
     * No two stones alike.
     *
     * Identical wedges are what made this read as a moulding rather than as
     * masonry. Each block now takes its own radial thickness, its own depth
     * and a slightly different share of the arc, seeded per index so the ring
     * is stable across reloads — a real arch is cut from stones that were
     * never quite the same size.
     */
    const rng = createRng(0x2b17f3)
    return Array.from({ length: VOUSSOIRS }, (_, i) => {
      const outer = outerR * range(rng, 0.965, 1.035)
      const inner = innerR * range(rng, 0.97, 1.02)
      const d = blockDepth * range(rng, 0.88, 1.14)
      const shrink = range(rng, 0.94, 1.0)
      return {
        geo: voussoirGeometry(inner, outer, i * step + joint / 2, (step - joint) * shrink, d),
        tint: range(rng, -0.1, 0.08),
      }
    })
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
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.35,
    normalMap: map,
    normalScale: normalScale,
  }

  /*
   * Positioned so the foot of the arch dips just under the surface.
   *
   * Sitting exactly ON the water it reads as placed there; a little of it
   * drowned reads as something that has been standing while the water rose
   * around it. Only a little — the opening still has to show sky through it.
   */
  return (
    <group position={[0, radius * 0.965, -150]}>
      {/* Outer ring of voussoirs — true arc segments, not boxes. */}
      {voussoirs.map((v, i) => (
        <mesh castShadow receiveShadow key={i} geometry={v.geo}>
          <meshStandardMaterial
            {...stoneProps}
            color={palette.monolith.clone().offsetHSL(0, 0, v.tint)}
          />
        </mesh>
      ))}

      {/* Concentric orders receding into the opening. */}
      {orders.map((o, i) => (
        <mesh castShadow receiveShadow key={`ord-${i}`} position={[0, 0, o.z]}>
          <torusGeometry args={[o.r, o.tube, o.machined ? 10 : 6, 88]} />
          <meshStandardMaterial
            color={palette.monolith}
            roughness={o.machined ? 0.42 : 0.8}
            metalness={o.machined ? 0.55 : 0}
            envMapIntensity={o.machined ? 0.9 : 0.4}
            normalMap={o.machined ? null : ringMap}
            normalScale={normalScale}
          />
        </mesh>
      ))}

      {/*
        Wet band at the waterline.

        The submerged foot alone is not enough: what says half-drowned is the
        wet stone just ABOVE the surface, dark and much less rough, catching a
        sheen the dry stone above it does not. Same treatment the piers get.
      */}
      <mesh castShadow={false} receiveShadow position={[0, -radius * 0.9, 0]}>
        <boxGeometry args={[radius * 0.9, radius * 0.2, blockDepth * 1.25]} />
        <meshStandardMaterial
          color={palette.monolith.clone().offsetHSL(0, 0.02, -0.17)}
          roughness={0.3}
          metalness={0}
          envMapIntensity={0.75}
          normalMap={map}
          normalScale={normalScale}
        />
      </mesh>

      {/* The membrane, set deep in the bore. */}
      <mesh castShadow receiveShadow ref={glow} position={[0, 0, -blockDepth * 2.6]}>
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

      {/*
        NO BUTTRESSES.

        Side supports were built and removed. Structurally they were the right
        idea — an arch this size needs its thrust taken — but they read as
        lumps stuck to the ring rather than as anything carrying it, and they
        broke the one thing the ring has going for it: a clean circle against
        the sky. The silhouette is the whole object here.

        If the arch ever needs to look supported, the answer is foundations
        UNDER it rather than masses beside it.
      */}
    </group>
  )
}
