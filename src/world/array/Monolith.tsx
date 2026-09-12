'use client'

import { memo, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector2, type MeshStandardMaterial } from 'three'
import { createRng, range } from '@/lib/rng'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { type Texture } from 'three'
import { tileStone } from '../materials/stone'
import { ArchedBay } from './ArchedBay'
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
function MonolithImpl({
  placement,
  palette,
  emphasis = 0,
  detailed = false,
  stoneNormal,
  stoneRough,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  placement: Placement
  palette: Palette
  emphasis?: number
  /**
   * Whether to cut arched bays into the faces.
   *
   * Each bay is three extruded plates plus seven meshes. Applied to every
   * pier including the scatter field that was well over a thousand meshes and
   * it collapsed the frame rate — which, on a 120Hz panel, is the judder that
   * reads as flicker. Only the four section piers are ever looked at closely,
   * so only they get bays.
   */
  detailed?: boolean
  /** Shared, loaded once by ArrayWorld — never per instance. See the note there. */
  stoneNormal: Texture
  stoneRough: Texture
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth, shoulder, detail, submerge } = placement

  /**
   * Local height of the real water surface.
   *
   * The group sits at world y = height/2 - submerge, so world y = 0 — the
   * water — is at this local height. The stain has to sit exactly there or it
   * floats above the surface, or drowns below it.
   */
  const waterLocalY = submerge - height / 2
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const noTex = useScene((s) => s.flags.noTex)

  const normalMap = useMemo(
    () => tileStone(stoneNormal, width, height, maxAniso),
    [stoneNormal, width, height, maxAniso],
  )
  const roughMap = useMemo(
    () => tileStone(stoneRough, width, height, maxAniso),
    [stoneRough, width, height, maxAniso],
  )
  // Per-pier variation.
  //
  // Identical material on every pier is the clearest tell that these came out
  // of a loop. Real masonry differs block to block — quarried at different
  // times, weathered at different rates — so each takes a small deterministic
  // offset in tone and relief, seeded from its own dimensions so it is stable
  // across reloads and visual tests.
  const vary = useMemo(() => {
    const rng = createRng(Math.round(width * 977 + height * 131 + depth * 17))
    return {
      relief: range(rng, 1.15, 1.6),
      tint: range(rng, -0.11, 0.09),
      rough: range(rng, -0.05, 0.06),
    }
  }, [width, height, depth])

  const normalScale = useMemo(
    () => new Vector2(vary.relief, vary.relief),
    [vary.relief],
  )

  const wetColor = useMemo(() => {
    const c = palette.monolith.clone()
    c.offsetHSL(0, 0.02, -0.16)
    return c
  }, [palette.monolith])

  const bodyColor = useMemo(() => {
    const c = palette.monolith.clone()
    // Vary lightness only; a hue shift would read as different stone entirely.
    c.offsetHSL(0, 0, vary.tint)
    return c
  }, [palette.monolith, vary.tint])

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)

  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 7, delta)
    const e = eased.current
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = e * 0.045
      m.roughness = 0.86 + vary.rough - e * 0.06
      m.envMapIntensity = 0.35 + e * 0.1
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const mat = (
    <meshStandardMaterial
      ref={collect}
      color={bodyColor}
      roughness={0.86 + vary.rough}
      metalness={0}
      envMapIntensity={0.35}
      normalMap={noTex ? null : normalMap}
      normalScale={normalScale}
      roughnessMap={noTex ? null : roughMap}
      emissive={palette.sunColor}
      emissiveIntensity={0}
    />
  )

  /**
   * Interaction happens on ONE invisible box, never on the visible geometry.
   *
   * R3F raycasts against every object carrying a pointer handler on every
   * pointer move. Handlers used to be on every mesh of every pier — core, four
   * pilasters, string courses, two cornice steps, two plinth steps,
   * buttresses, and every plate of every arched bay, some of them extruded
   * geometry with thousands of triangles. Hundreds of meshes, tested on every
   * mouse move, is enough work to drop a frame — and a dropped frame during
   * camera motion is a black flash.
   *
   * A single box the size of the pier does the same job for one cheap test.
   */
  const interactive = Boolean(onClick)

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

  /** Opts a mesh out of raycasting entirely. */
  const noHit = useMemo(() => () => null, [])

  // Proportions of the order. The pilaster is a fraction of the face, and the
  // recessed core sits back behind it — that setback is the whole effect.
  const pil = Math.min(width, depth) * 0.17
  const setback = pil * 0.55
  const coreW = width - setback * 2
  const coreD = depth - setback * 2
  const bevel = Math.min(0.22, width * 0.035)

  // String courses divide the shaft into storeys.
  const n = Math.max(1, Math.min(3, detail.reveals))
  const courses = useMemo(
    () => Array.from({ length: n }, (_, i) => height * ((i + 1) / (n + 1)) - height / 2),
    [n, height],
  )

  // The storeys BETWEEN those courses are where the bays go.
  const storeys = useMemo(() => {
    const count = n + 1
    const storeyH = height / count
    return Array.from({ length: count }, (_, i) => ({
      centre: -height / 2 + storeyH * (i + 0.5),
      height: storeyH,
    }))
  }, [n, height])

  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* The only thing in this pier that can be hit by a ray. */}
      {interactive && (
        <mesh {...handlers} visible={false}>
          <boxGeometry args={[width * 1.2, height, depth * 1.2]} />
        </mesh>
      )}

      {/* Recessed core. Set back on all four sides so each face reads as a
          deep panel rather than a flat side. */}
      <mesh raycast={noHit}>
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
          raycast={noHit}
        >
          {mat}
        </RoundedBox>
      ))}

      {/* Arched bays, one per storey, on the two faces the camera can see.
          Real recessed voids with layered orders — this is where the sense of
          a carved, built object actually comes from. */}
      {detailed &&
        storeys.map((st, i) =>
        [0, Math.PI].map((rot, f) => (
          <group
            key={`bay-${i}-${f}`}
            position={[0, st.centre, 0]}
            rotation={[0, rot, 0]}
          >
            <group position={[0, -st.height / 2, coreD / 2]}>
              <ArchedBay
                width={coreW * 0.92}
                height={st.height * 0.86}
                depth={Math.min(coreD, coreW) * 0.26}
              >
                {mat}
              </ArchedBay>
            </group>
          </group>
          )),
        )}

      {/* String courses banding between the pilasters. Proud of the core but
          shy of the pilasters, so they read as a moulding, not a collar. */}
      {courses.map((y, i) => (
        <mesh key={`course-${i}`} position={[0, y, 0]} raycast={noHit}>
          <boxGeometry args={[width - pil * 0.5, height * 0.022, depth - pil * 0.5]} />
          {mat}
        </mesh>
      ))}

      {/* DENTIL COURSE.
          A row of small blocks under the cornice. Repetition at a fine pitch
          is what gives a cornice its shadow texture at distance, and it is one
          of the cheapest details that unmistakably reads as carved rather than
          cast. Only on detailed piers — the count is per-pier, so it is the
          one piece of geometry here that scales badly if applied everywhere. */}
      {detailed && detail.cornice > 0 && (
        <group position={[0, height / 2 - height * 0.045, 0]}>
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i + 0.5) / 9 - 0.5
            return [0, 1].map((axis) => (
              <mesh
                key={`${i}-${axis}`}
                position={
                  axis === 0
                    ? [t * width * 0.92, 0, (depth / 2) * 1.01]
                    : [t * width * 0.92, 0, (-depth / 2) * 1.01]
                }
              >
                <boxGeometry args={[width * 0.032, height * 0.016, depth * 0.035]} />
                {mat}
              </mesh>
            ))
          })}
        </group>
      )}

      {/* Cornice, in two steps. A single slab reads as a lid; two reads as
          a moulding. */}
      {detail.cornice > 0 && (
        <group position={[0, height / 2, 0]}>
          <mesh position={[0, -height * 0.026, 0]} raycast={noHit}>
            <boxGeometry
              args={[width * (1 + detail.cornice * 0.6), height * 0.02, depth * (1 + detail.cornice * 0.6)]}
            />
            {mat}
          </mesh>
          <mesh position={[0, -height * 0.008, 0]} raycast={noHit}>
            <boxGeometry
              args={[width * (1 + detail.cornice * 1.5), height * 0.018, depth * (1 + detail.cornice * 1.5)]}
            />
            {mat}
          </mesh>
        </group>
      )}

      {/* CORNER BUTTRESSES.
          Sloped masses thickening the base, which is how a real pier carries
          its load into the ground — and which fixes the silhouette problem of
          a shaft meeting the water at a bare right angle. */}
      {detailed &&
        corners.map(([sx, sz], i) => (
          <mesh
            key={`butt-${i}`}
            position={[
              (sx * (width - pil * 0.5)) / 2,
              -height / 2 + height * 0.11,
              (sz * (depth - pil * 0.5)) / 2,
            ]}
            rotation={[sz * 0.07, 0, -sx * 0.07]}
            raycast={noHit}
          >
            <boxGeometry args={[pil * 1.25, height * 0.22, pil * 1.25]} />
            {mat}
          </mesh>
        ))}

      {/* Plinth where the pier meets the water. */}
      {detail.plinth > 0 && (
        <group position={[0, -height / 2, 0]}>
          <mesh position={[0, height * 0.016, 0]} raycast={noHit}>
            <boxGeometry
              args={[width * (1 + detail.plinth * 1.4), height * 0.032, depth * (1 + detail.plinth * 1.4)]}
            />
            {mat}
          </mesh>
          <mesh position={[0, height * 0.042, 0]} raycast={noHit}>
            <boxGeometry
              args={[width * (1 + detail.plinth * 0.6), height * 0.02, depth * (1 + detail.plinth * 0.6)]}
            />
            {mat}
          </mesh>
        </group>
      )}

      {/* Waterline.
          Anything standing in water darkens for the first metre or so and
          stays wet — lower roughness, so it catches a sheen the dry stone
          above it does not. The tide mark is sharp, which is what makes a
          pier read as standing IN the water rather than placed on top of it. */}
      <mesh position={[0, waterLocalY + height * 0.028, 0]} raycast={noHit}>
        <boxGeometry args={[width * 1.004, height * 0.056, depth * 1.004]} />
        <meshStandardMaterial
          ref={collect}
          color={wetColor}
          roughness={0.34}
          metalness={0}
          envMapIntensity={0.6}
          normalMap={noTex ? null : normalMap}
          normalScale={normalScale}
        />
      </mesh>

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
          raycast={noHit}
        >
          {mat}
        </RoundedBox>
      )}
    </group>
  )
}

/**
 * Memoised.
 *
 * Hovering changes one value in the store, but ArrayWorld re-renders on it and
 * every pier re-renders with it — fifty components rebuilding their trees on
 * each pointer move, for a highlight that affects exactly one of them. That is
 * a large amount of work on a frame the user is already moving the camera
 * through, and dropping such a frame is a visible black flash.
 *
 * With this, only the pier whose emphasis actually changed re-renders.
 */
export const Monolith = memo(MonolithImpl)
