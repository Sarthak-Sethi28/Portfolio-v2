'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide,
  Color,
  Matrix4,
  MathUtils,
  Quaternion,
  RepeatWrapping,
  Vector2,
  Vector3,
  type InstancedMesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import type { Palette } from '../atmosphere/palette'
import { arcPlate, chamferBox, merge, placed, wedge } from '../geometry/ring'
import { createRng, range } from '@/lib/rng'

/**
 * THE APERTURE — the threshold to World 2.
 *
 * A monumental engineered machine standing in the water, not a carved arch.
 * It is built as three CONCENTRIC STRUCTURAL LAYERS, each at its own depth in
 * Z, with recessed channels between them:
 *
 *   L1  OUTER ARMOUR    segmented plates, the heaviest mass, furthest forward
 *   --  channel         a deep recess; the shadow line is the detail
 *   L2  MECHANICAL      set back, crossed by clamps bridging L1 to L3
 *   --  channel
 *   L3  INNER FRAME     clean, proud again, carrying the energy channel
 *
 * That stack is the whole design. The depth has to be real — layers at
 * different Z casting into each other's recesses — because the alternative,
 * a ring with detail applied to its face, reads as a prop the instant the
 * light moves. This world is lit from BELOW at night, so anything that
 * depends on a frontal key is worthless here.
 *
 * Order of operations, deliberately: large forms first, medium mechanical
 * detail second, indicator lights last and tiny. Roughly 70% graphite, 20%
 * muted gold, 8% red emissive, 2% green.
 *
 * PERFORMANCE. Every repeated element is built once and merged into a single
 * buffer per material, and the indicators are instanced — about a dozen draw
 * calls for the whole assembly rather than one per plate.
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
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const R = radius

  /*
   * LAYER RADII.
   *
   * The brief asked for a band of 14-18% of the radius, which on its own would
   * have produced a hoop — the reference's structure is a little over 40% of
   * its outer radius. Read as 14-18% PER LAYER the two agree exactly, so that
   * is what this is: three bands of roughly 15/15/11%, leaving the opening at
   * 54% of the outer radius, which measures the reference almost dead on.
   */
  const L = useMemo(
    () => ({
      r1o: R, r1i: R * 0.845,
      r2o: R * 0.825, r2i: R * 0.675,
      r3o: R * 0.655, r3i: R * 0.545,
      // Centre-Z per layer. The differences ARE the recessed channels: L2 sits
      // a seventh of the radius behind L1, so the gap between them is a real
      // shadowed trench rather than a drawn line.
      z1: R * 0.01, d1: R * 0.3,
      z2: -R * 0.09, d2: R * 0.22,
      z3: -R * 0.03, d3: R * 0.26,
    }),
    [R],
  )

  const graphite = useMemo(
    // Faintly tinted by the world palette so the machine still belongs to the
    // same day and night as everything else, without giving up its own colour.
    /*
     * Lighter than true graphite, on purpose.
     *
     * #23262a is the correct colour for the material and came out as a black
     * hole: at this metalness the surface has almost no diffuse response, and
     * the only light in this world comes up off the water. The colour has to
     * be lifted so that the little diffuse there is actually lands somewhere.
     */
    () => new Color('#31363c').lerp(palette.monolith, 0.12),
    [palette.monolith],
  )

  const armourMap = useMemo(() => {
    if (!stone) return null
    const t = stone.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    // ExtrudeGeometry writes UVs in world coordinates, so this is one tile per
    // ~7 units — the scale of rolled plate, not of rock.
    t.repeat.set(0.14, 0.14)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  // Gentle: a normal map is here to break up the metal, not to relight it.
  const normalScale = useMemo(() => new Vector2(0.35, 0.35), [])

  /* ------------------------------------------------------------------ *
   * L1 — OUTER STRUCTURAL RING
   * ------------------------------------------------------------------ */
  const outer = useMemo(() => {
    /*
     * Sixteen plates of DIFFERENT widths.
     *
     * Equal segments read as a machined cog — the eye picks up the period
     * instantly and the object turns into a gear. Real armour is panelised
     * around what is underneath it, so the widths vary. They are weights
     * normalised to a full turn, which means the ring always closes exactly
     * however the weights are edited.
     */
    const W = [1.25, 0.85, 1.0, 1.18, 0.8, 1.05, 1.3, 0.9, 1.0, 1.22, 0.85, 1.1, 0.95, 1.28, 0.9, 1.05]
    const total = W.reduce((a, b) => a + b, 0)
    // The seam. Deep and narrow: this is where the shadow between plates lives.
    const seam = 0.016

    const rng = createRng(0x5a17c2)
    const plates: ReturnType<typeof placed>[] = []
    const trims: ReturnType<typeof placed>[] = []

    let a = 0
    for (let i = 0; i < W.length; i++) {
      const sweep = (Math.PI * 2 * W[i]) / total
      const start = a + seam / 2
      const span = sweep - seam
      a += sweep

      // Slight per-plate depth variation: plates sit fractionally proud of one
      // another, so the ring's front face is not a single flat disc.
      const d = L.d1 * range(rng, 0.94, 1.06)
      plates.push(
        placed(arcPlate(L.r1i, L.r1o, start, span, d, 0.06), new Vector3(0, 0, L.z1)),
      )

      /*
       * Gold trim on SELECTED plates only.
       *
       * Trimming every plate would make the gold a stripe rather than an
       * accent, and the reference is very disciplined about this — the metal
       * marks particular structural members, so it reads as meaning something.
       */
      if (rng() < 0.42) {
        const t = R * 0.012
        trims.push(
          placed(
            arcPlate(L.r1o - t * 2.6, L.r1o - t * 0.6, start, span, d * 0.4, 0.12),
            new Vector3(0, 0, L.z1 + d * 0.36),
          ),
        )
      }
      // A radial gold rib across a few plates, at the seam side.
      if (rng() < 0.3) {
        const mid = (L.r1i + L.r1o) / 2
        const ang = start + span * 0.5
        trims.push(
          placed(
            chamferBox((L.r1o - L.r1i) * 0.88, R * 0.022, d * 0.34, R * 0.006),
            new Vector3(Math.cos(ang) * mid, Math.sin(ang) * mid, L.z1 + d * 0.33),
            ang,
          ),
        )
      }
    }
    return { plates: merge(plates), trims: merge(trims) }
  }, [L, R])

  /* ------------------------------------------------------------------ *
   * L2 — MIDDLE MECHANICAL RING
   * ------------------------------------------------------------------ */
  const middle = useMemo(() => {
    const rng = createRng(0x31d0a7)

    // The recessed channel itself: one continuous annulus, set well back.
    const channel = placed(
      arcPlate(L.r2i, L.r2o, 0, Math.PI * 2, L.d2, 0.04, 96),
      new Vector3(0, 0, L.z2),
    )

    /*
     * CLAMPS — the bridge pieces.
     *
     * Each spans radially from the outer armour across the recessed channel to
     * the inner frame, sitting proud of both. They are the elements that make
     * the three layers read as ONE assembled machine instead of three rings
     * that happen to share a centre, and they are where the reference puts its
     * heaviest visual weight: the big members at nine, twelve and three.
     */
    const span = L.r1i - L.r3o
    const mid = (L.r1i + L.r3o) / 2
    const clamps: ReturnType<typeof placed>[] = []
    const goldModules: ReturnType<typeof placed>[] = []
    const greens: Matrix4[] = []
    const reds: Matrix4[] = []

    const majors = [Math.PI / 2, Math.PI, 0]
    const minors = [0.62, 1.18, 2.05, 2.62, 3.72, 5.6]

    const put = (ang: number, major: boolean) => {
      const w = span * 1.16
      const h = R * (major ? 0.13 : 0.075)
      const d = R * (major ? 0.17 : 0.12)
      const zc = L.z2 + L.d2 * 0.5 + d * 0.32
      const pos = new Vector3(Math.cos(ang) * mid, Math.sin(ang) * mid, zc)
      clamps.push(placed(chamferBox(w, h, d, R * 0.012), pos, ang))

      // A gold module capping some clamps.
      if (major || rng() < 0.5) {
        goldModules.push(
          placed(
            chamferBox(w * 0.26, h * 0.82, d * 0.5, R * 0.008),
            new Vector3(
              Math.cos(ang) * (mid + span * 0.3),
              Math.sin(ang) * (mid + span * 0.3),
              zc + d * 0.4,
            ),
            ang,
          ),
        )
      }

      /*
       * Indicators, LAST and tiny.
       *
       * Two percent of the object. They only ever sit on a clamp, because a
       * light that is not attached to a mechanism is decoration — the moment
       * they scatter over the plates the whole thing looks like a fairground
       * ride rather than equipment.
       */
      const n = major ? 3 : 1
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * h * 0.42
        const p = new Vector3(
          Math.cos(ang) * (mid - span * 0.12) - Math.sin(ang) * off,
          Math.sin(ang) * (mid - span * 0.12) + Math.cos(ang) * off,
          zc + d * 0.52,
        )
        const m = new Matrix4().compose(
          p,
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), ang),
          new Vector3(1, 1, 1),
        )
        if (major && k === 1 && rng() < 0.5) reds.push(m)
        else greens.push(m)
      }
    }

    majors.forEach((a) => put(a, true))
    minors.forEach((a) => put(a, false))

    return {
      channel,
      clamps: merge(clamps),
      goldModules: merge(goldModules),
      greens,
      reds,
    }
  }, [L, R])

  /* ------------------------------------------------------------------ *
   * L3 — INNER FRAME, plus the parts that give the assembly a back
   * ------------------------------------------------------------------ */
  const inner = useMemo(() => {
    const frame = placed(
      arcPlate(L.r3i, L.r3o, 0, Math.PI * 2, L.d3, 0.05, 108),
      new Vector3(0, 0, L.z3),
    )

    /*
     * A solid disc behind everything.
     *
     * Without it the recessed channels are literal holes: you see the sky
     * through the gaps between layers, and the whole illusion of depth
     * collapses into a stencil. The backing is what turns a gap into a recess.
     */
    const backing = placed(
      arcPlate(L.r3i, L.r1o * 0.995, 0, Math.PI * 2, R * 0.05, 0, 96),
      new Vector3(0, 0, -R * 0.23),
    )
    return merge([frame, backing])
  }, [L, R])

  /* ------------------------------------------------------------------ *
   * FEET — the ring has to look like it weighs something
   * ------------------------------------------------------------------ */
  const feet = useMemo(() => {
    const parts: ReturnType<typeof placed>[] = []
    const golds: ReturnType<typeof placed>[] = []
    /*
     * OUT TO THE SIDES, where a buttress belongs.
     *
     * They were at 0.6R, which put both masses under the middle of the ring —
     * two slabs huddled at the bottom of the opening, propping up the part of
     * the structure that needs it least. A buttress takes THRUST, and an arch
     * throws its thrust outward and down, so the feet have to stand where that
     * force lands: out at the flanks, meeting the ring's lower-outer edge.
     *
     * At 0.78R the top of each mass runs up into the outer armour band rather
     * than stopping short of it, so the ring and its footing read as one
     * structure. A support with a gap between it and the thing it supports is
     * scenery.
     */
    const OUT = R * 0.68
    for (const side of [-1, 1]) {
      /*
       * Tall enough to REACH the ring, wide enough to look like it is taking
       * the load. The previous mass stopped short and read as a block parked
       * near the arch; this one runs from well under the waterline up into the
       * armour band, so the ring lands ON it.
       */
      const h = R * 0.65
      const body = wedge(R * 0.42, R * 0.75, h, R * 0.5, R * 0.014)
      parts.push(
        // Splayed: wide at the base, leaning its foot outward, so the mass
        // spreads into the water instead of balancing on it.
        placed(body, new Vector3(side * OUT, -R * 1.35, -R * 0.02), side * 0.22),
      )
      // Vertical gold stripes down the face, as in the reference — kept high
      // on the mass so they stay clear of the waterline.
      for (const k of [-1, 1]) {
        golds.push(
          placed(
            chamferBox(R * 0.032, h * 0.46, R * 0.032, R * 0.008),
            new Vector3(side * OUT + k * R * 0.14, -R * 1.35 + h * 0.62, R * 0.24),
            side * 0.22,
          ),
        )
      }
    }
    return { body: merge(parts), stripes: merge(golds) }
  }, [R])

  /* ------------------------------------------------------------------ *
   * Materials and the energy channel
   * ------------------------------------------------------------------ */
  const redRef = useRef<MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const m = redRef.current
    if (!m) return
    // Alive, but barely — a slow breath, rising hard only under charge.
    const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.6)
    m.emissiveIntensity = MathUtils.lerp(
      m.emissiveIntensity,
      2.0 + breath * 0.35 + charge * 4.5,
      0.08,
    )
  })

  const setGreens = useCallback(
    (mesh: InstancedMesh | null) => {
      if (!mesh) return
      middle.greens.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.instanceMatrix.needsUpdate = true
    },
    [middle.greens],
  )
  const setReds = useCallback(
    (mesh: InstancedMesh | null) => {
      if (!mesh) return
      middle.reds.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.instanceMatrix.needsUpdate = true
    },
    [middle.reds],
  )

  const GOLD = '#b98f3e'

  return (
    /*
     * It STANDS on its feet.
     *
     * At 0.72R the bottom third of the machine was below the surface, and the
     * buttresses were drowned with it — so however heavy they were built, you
     * could not see the ring meeting them, and the whole assembly read as an
     * arch sunk in water rather than as a structure that was installed here.
     * A support only does its job visually if you can watch the load arrive.
     *
     * Lifted to 1.05R, the lower arc clears the surface and lands on the
     * masses at either corner, which are now tall enough to come up and take
     * it. The water still cuts the feet, which is the detail that says the sea
     * rose around this thing rather than that it was built floating.
     */
    <group position={[0, R * 1.05, -150]}>
      {/* ---- L1: outer armour ---- */}
      <mesh castShadow receiveShadow geometry={outer.plates}>
        <meshStandardMaterial
          color={graphite}
          metalness={0.72}
          roughness={0.52}
          /*
           * Deliberately far above 1.
           *
           * envMapIntensity is a per-material multiplier on the environment,
           * and the scene environment is dimmed to roughly a fifth at night to
           * keep stone from glowing like a sunset. Metal has nothing BUT the
           * environment, so the ring has to buy that back or it renders as a
           * silhouette. This is the honest way to keep the material spec —
           * metalness stays where a machined alloy belongs, and the thing it
           * reflects is turned back up to where it can be seen.
           */
          envMapIntensity={5.5}
          normalMap={armourMap}
          normalScale={normalScale}
        />
      </mesh>
      <mesh castShadow receiveShadow geometry={outer.trims}>
        <meshStandardMaterial
          color={GOLD}
          metalness={0.9}
          roughness={0.34}
          envMapIntensity={6.5}
          /*
           * Gold has to carry a little of its own light.
           *
           * A near-metal surface has almost no diffuse term — everything it
           * shows you is reflected — and this sky has been emptied, so there is
           * next to nothing to reflect. Without this the trim reads as dark
           * brown scratches. It is a floor, not a glow.
           */
          emissive={GOLD}
          emissiveIntensity={0.42}
        />
      </mesh>

      {/* ---- L2: the recessed channel and its mechanism ---- */}
      <mesh receiveShadow geometry={middle.channel}>
        <meshStandardMaterial
          // Darker and rougher than the armour: it is in shadow by design, and
          // the contrast with L1 is what sells the trench.
          color={graphite.clone().multiplyScalar(0.62)}
          metalness={0.7}
          roughness={0.64}
          envMapIntensity={3.4}
        />
      </mesh>
      <mesh castShadow receiveShadow geometry={middle.clamps}>
        <meshStandardMaterial
          color={graphite}
          metalness={0.8}
          roughness={0.46}
          envMapIntensity={5.8}
        />
      </mesh>
      <mesh castShadow geometry={middle.goldModules}>
        <meshStandardMaterial
          color={GOLD}
          metalness={0.9}
          roughness={0.3}
          envMapIntensity={6.5}
          emissive={GOLD}
          emissiveIntensity={0.45}
        />
      </mesh>

      {/* ---- L3: inner frame (and the backing that makes recesses recesses) ---- */}
      <mesh castShadow receiveShadow geometry={inner}>
        <meshStandardMaterial
          color={graphite}
          metalness={0.78}
          roughness={0.48}
          envMapIntensity={5.8}
        />
      </mesh>

      {/*
        THE ENERGY CHANNEL.

        Set at the inner lip and slightly behind the frame's front face, so the
        frame shades it from directly ahead and you read a channel cut into the
        machine rather than a neon hoop laid on top of it.
      */}
      <mesh position={[0, 0, L.z3 + L.d3 * 0.24]}>
        <torusGeometry args={[L.r3i * 1.008, R * 0.016, 12, 160]} />
        <meshStandardMaterial
          ref={redRef}
          color="#1a0503"
          emissive="#ff2a12"
          emissiveIntensity={2.0}
          metalness={0}
          roughness={0.4}
        />
      </mesh>
      {/* A wider, much dimmer halo further back — the channel's spill on its
          own housing, which is what stops it reading as a drawn line. */}
      <mesh position={[0, 0, L.z3 - L.d3 * 0.1]}>
        <torusGeometry args={[L.r3i * 1.02, R * 0.036, 8, 120]} />
        <meshStandardMaterial
          color="#120402"
          emissive="#c01f0c"
          emissiveIntensity={0.5}
          metalness={0}
          roughness={0.7}
        />
      </mesh>

      {/*
        Real red light, so the channel LIGHTS the metal around it.

        Three is enough to wrap the inner frame and reach the water at the
        bottom of the ring; more would cost far more than it shows.
      */}
      {[Math.PI / 2, Math.PI * 1.22, Math.PI * 1.78].map((a, i) => (
        <pointLight
          key={`rl-${i}`}
          position={[Math.cos(a) * L.r3i * 0.92, Math.sin(a) * L.r3i * 0.92, R * 0.1]}
          color="#ff3a18"
          /*
           * Physically-correct falloff means intensity is not a 0-1 dial.
           *
           * Lights obey inverse square here, so a value that looks large is
           * ordinary once it has travelled twenty units to the metal. The
           * first pass used a twentieth of this and delivered essentially
           * nothing to the surfaces it was supposed to be lighting.
           */
          intensity={R * R * 0.4}
          distance={R * 1.9}
          decay={2}
        />
      ))}

      {/*
        THE MACHINE LIGHTS ITSELF.

        Raising envMapIntensity was the first attempt and it failed, for a
        reason worth writing down: a metal surface shows you reflections, and
        this sky has been deliberately emptied, so multiplying almost nothing
        by five and a half is still almost nothing. There is no light in this
        world arriving at the front of the ring at all — everything comes up
        off the water, behind and below.

        So the ring carries its own working lights, which is what a structure
        this size would actually have. Two cool sources set forward and to
        either side, grazing the plates so the layers cast into each other's
        recesses. Kept tight with `distance` so they light the machine and not
        the sea around it, and cool so the gold still reads as the warm thing.
      */}
      {[-1, 1].map((side) => (
        <pointLight
          key={`fill-${side}`}
          position={[side * R * 1.15, R * 0.5, R * 1.25]}
          color="#a9c6e6"
          /*
           * Sized against the distance it has to cross, not by feel.
           *
           * These sit about seventy units from the far side of the ring, and
           * inverse square turns that into a factor of five thousand. The
           * first value delivered roughly a fifth of a unit of light to the
           * plates it was aimed at, which is indistinguishable from off.
           */
          intensity={R * R * 3.2}
          distance={R * 3.2}
          decay={2}
        />
      ))}

      {/*
        One more, low and forward, for the feet and the springing.

        The pair above are set high to rake the crown, which leaves the bottom
        third of the machine — including the masses actually carrying it —
        unlit. A structure reads as heavy only if you can see what it stands on.
      */}
      <pointLight
        position={[0, -R * 0.55, R * 1.4]}
        color="#95b4d6"
        intensity={R * R * 1.6}
        distance={R * 2.8}
        decay={2}
      />

      {/*
        The bore. An open cylinder running back from the inner lip, seen from
        inside, so the opening has DEPTH — you look down a throat rather than
        through a hole punched in a disc. Left dark and empty.
      */}
      <mesh position={[0, 0, -R * 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[L.r3i, L.r3i, R * 0.52, 96, 1, true]} />
        <meshStandardMaterial
          color="#0b0d0f"
          side={BackSide}
          metalness={0.5}
          roughness={0.85}
        />
      </mesh>

      {/* ---- Feet ---- */}
      <mesh castShadow receiveShadow geometry={feet.body}>
        <meshStandardMaterial
          color={graphite.clone().multiplyScalar(0.88)}
          metalness={0.74}
          roughness={0.58}
          envMapIntensity={4.6}
          normalMap={armourMap}
          normalScale={normalScale}
        />
      </mesh>
      <mesh castShadow geometry={feet.stripes}>
        <meshStandardMaterial
          color={GOLD}
          metalness={0.9}
          roughness={0.36}
          envMapIntensity={6.5}
          emissive={GOLD}
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* ---- Indicators: instanced, tiny, last ---- */}
      <instancedMesh ref={setGreens} args={[undefined, undefined, middle.greens.length]}>
        <boxGeometry args={[R * 0.012, R * 0.028, R * 0.012]} />
        <meshStandardMaterial
          color="#04160b"
          emissive="#3cff88"
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={setReds} args={[undefined, undefined, middle.reds.length]}>
        <boxGeometry args={[R * 0.012, R * 0.028, R * 0.012]} />
        <meshStandardMaterial
          color="#180303"
          emissive="#ff4422"
          emissiveIntensity={3.0}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
