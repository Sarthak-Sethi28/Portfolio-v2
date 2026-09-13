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
  type Group,
  type InstancedMesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import type { Palette } from '../atmosphere/palette'
import { arcPlate, chamferBox, merge, placed, rubble } from '../geometry/ring'
import { createRng, range } from '@/lib/rng'
import { useScene } from '@/store/scene'

/**
 * THE APERTURE — one portal, two states.
 *
 * This is the centre of the whole sequence, so it is worth being exact about
 * what it is: an ANCIENT STONE RING with a machine inside it.
 *
 * At rest it reads as masonry — big weathered limestone voussoirs, deep dark
 * joints, standing in broken rock. A previous version built it as graphite
 * armour plating and it looked like a prop: dark plastic panels with lights
 * glued on, the thing you would get from someone who had seen the idea rather
 * than the thing. The correction is that the STONE is the object. The machine
 * is underneath it, and you are not supposed to know it is there.
 *
 * As it wakes, the blocks LIFT AND SEPARATE along their own radii, and what
 * shows through the widening joints is gold and red light that was inside the
 * ring the whole time. That is the transformation in the boards, and it is why
 * both states are one piece of geometry driven by a single value rather than
 * two rings swapped over: the reveal only works if the viewer recognises the
 * stone they were just looking at.
 *
 *   activation 0 — THE ARRIVAL. Stone. Calm. Nothing to suggest a mechanism.
 *   activation 1 — THE ACTIVATION. Separated, lit from within, alive.
 */
export function Aperture({
  palette,
  stone,
  rough,
  radius = 60,
  charge = 0,
}: {
  palette: Palette
  /** Shared limestone normal map, loaded once by ArrayWorld. */
  stone?: Texture
  /**
   * The matching roughness map, used here as BOTH roughness and a faint
   * albedo mottle.
   *
   * The normal map alone was doing nothing visible on the block faces, and
   * the reason is lighting: this composition is backlit, so the fronts of the
   * voussoirs are lit almost entirely by a smooth environment, and a smooth
   * environment barely changes as the normal is perturbed. Varying the
   * SURFACE RESPONSE works where varying the normal does not — mottled
   * roughness breaks up the specular, and the same greyscale multiplied into
   * the base colour gives the stone the blotching that every real limestone
   * face has. It is checked greyscale (135/133/132), so it is safe in the
   * green channel that roughnessMap actually reads.
   */
  rough?: Texture
  /**
   * Default 60, not 42.
   *
   * At 42 the portal sat in the middle distance looking like an ornament the
   * columns happened to flank. In the boards it DOMINATES — it is the reason
   * the place exists and everything else is staffage around it. Scale is most
   * of why the reference reads as monumental and this did not.
   */
  radius?: number
  /** 0 to 1 while the visitor holds to enter. */
  charge?: number
}) {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const R = radius

  /*
   * Night IS activation.
   *
   * The two were separate values and that was wrong — it let the world arrive
   * at night with the portal still asleep, which is a contradiction the boards
   * never have. The gate waking and the world turning over are one event.
   */
  const nightLevel = useScene((s) => s.nightLevel)

  /*
   * PROPORTIONS, measured off the boards rather than guessed.
   *
   * The stone band is about 30% of the outer radius — noticeably thinner than
   * the armoured version, which is part of why that one read as heavy plastic
   * rather than as cut stone. A masonry ring is mostly OPENING.
   */
  const L = useMemo(
    () => ({
      rOut: R,
      rIn: R * 0.70,
      depth: R * 0.34,
      // The machine beneath, slightly smaller so the stone covers it at rest.
      coreOut: R * 0.985,
      // Never narrower than the stone's opening: at 0.685 the machine's inner
      // band protruded past the intrados and was visible as a gold hoop inside
      // the arch before anything had happened.
      coreIn: R * 0.705,
    }),
    [R],
  )

  const limestone = useMemo(() => {
    // Warm pale stone by day; the same rock read cold and dark once the sun
    // has gone, rather than a different material.
    const day = new Color('#bdb4a2')
    const night = new Color('#2c2a28')
    return day.clone().lerp(night, nightLevel)
  }, [nightLevel])

  const stoneMap = useMemo(() => {
    if (!stone) return null
    const t = stone.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    /*
     * ExtrudeGeometry writes UVs in WORLD coordinates, so this is one tile per
     * nine units or so — the scale a hand-sized rock face actually is. Set by
     * the shape's span, not by taste: at repeat 2 it tiled eighty times across
     * a single block and vanished into noise.
     */
    /*
     * Finer than the 0.11 the blocks inherited.
     *
     * That put one tile every nine world units, which on a ring of radius 60
     * meant roughly two tiles across an entire voussoir — far too coarse to be
     * surface, so the stone rendered as smooth clay. Erosion on a block this
     * size is a centimetres-deep texture, and it has to tile at that scale or
     * it may as well not be there.
     */
    t.repeat.set(0.34, 0.34)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  const roughMap = useMemo(() => {
    if (!rough) return null
    const t = rough.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(0.26, 0.26)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [rough, maxAniso])

  /*
   * Stronger than before, and now safe to be.
   *
   * This was pinned at 0.45 after a bug where the map's huge low-frequency
   * lumps swung whole blocks between sky and ground colour. That was a
   * symptom of the coarse tiling above, not of the strength — at a proper
   * repeat the map is surface detail rather than a per-block gradient, so it
   * can be pushed to where weathered stone actually lives. A timid normal map
   * is indistinguishable from none.
   */
  const normalScale = useMemo(() => new Vector2(1.0, 1.0), [])

  /* ------------------------------------------------------------------ *
   * THE VOUSSOIRS — large, unequal, deeply jointed
   * ------------------------------------------------------------------ */
  const BLOCKS = 18
  const blocks = useMemo(() => {
    /*
     * Unequal shares of the arc.
     *
     * Equal wedges read as a machined cog: the eye finds the period instantly.
     * Real voussoirs were cut from whatever the quarry gave up, so these are
     * weights normalised to a full turn — which also means the ring closes
     * exactly however the weights are edited.
     */
    const W = [1.18, 0.88, 1.05, 1.0, 1.22, 0.9, 1.1, 0.95, 1.15, 0.85, 1.08, 1.0, 1.2, 0.92, 1.04, 0.98, 1.14, 0.88]
    const total = W.reduce((a, b) => a + b, 0)
    /*
     * The joint, at about 2% of each block's arc.
     *
     * This was 16% once and the arch came out as a sawblade — nineteen wedges
     * floating at arm's length from each other. Blocks in a real arch TOUCH;
     * the structure stands because each stone presses on its neighbours, and
     * the mortar line is a couple of percent of the stone, not a fifth of it.
     */
    const joint = 0.03
    const rng = createRng(0x7c31a9)
    const out: {
      geo: ReturnType<typeof arcPlate>
      mid: number
      tint: number
      hue: number
      z: number
      lift: number
    }[] = []
    let a = -Math.PI / 2
    for (let i = 0; i < BLOCKS; i++) {
      const sweep = (Math.PI * 2 * W[i]) / total
      const span = sweep * (1 - joint)

      /*
       * INTRADOS TRUE, EXTRADOS ROUGH. This is the whole thing.
       *
       * Every block shared one inner and one outer radius, so the ring came
       * out as a mathematically perfect annulus with hairline joints — a
       * washer turned on a lathe, which is exactly what it looked like. Real
       * voussoirs are dressed precisely on the face that forms the opening,
       * because that face IS the arch and it has to be a true circle, and left
       * rough on the back where nobody was going to look. So the inner radius
       * is identical for all eighteen and the OUTER one varies by several
       * percent, which gives the silhouette the ragged step that says quarried.
       *
       * An earlier version varied both and the ring visibly came apart at the
       * waterline. Varying only the extrados gets the roughness for free
       * without ever disturbing the geometry that holds the arch together.
       */
      const outer = L.rOut * range(rng, 0.9, 1.06)
      // Each stone also sits at its own depth, so the front face is not one
      // flat plane. Relief between neighbours is most of what reads as
      // masonry at distance — far more than any texture on the surface.
      const d = L.depth * range(rng, 0.82, 1.22)

      out.push({
        geo: arcPlate(
          L.rIn,
          outer,
          a + sweep * joint * 0.5,
          span,
          d,
          // A generous chamfer. The dark line down every arris is the joint;
          // at 0.05 the blocks met with no shadow between them at all.
          0.1,
        ),
        mid: a + sweep / 2,
        z: range(rng, -0.07, 0.07) * L.depth,
        /*
         * Real variation, not a hint of it.
         *
         * These were +/-0.03 and the ring read as one moulded object. That
         * number came from a bad diagnosis: the blocks once looked like a
         * checkerboard and the tint got blamed, when the actual cause was a
         * normal map at 1.8 swinging whole faces between sky and ground. With
         * that fixed, the stone can vary the way a quarry actually varies.
         */
        tint: range(rng, -0.075, 0.06),
        hue: range(rng, -0.018, 0.018),
        lift: range(rng, 0.65, 1.35),
      })
      a += sweep
    }
    return out
  }, [L])

  const blockRefs = useRef<(Group | null)[]>([])
  const setBlock = useCallback(
    (i: number) => (g: Group | null) => {
      blockRefs.current[i] = g
    },
    [],
  )

  /* ------------------------------------------------------------------ *
   * THE MACHINE BENEATH — hidden at rest, revealed as the stone parts
   * ------------------------------------------------------------------ */
  /*
   * THE MACHINE: three concentric bands at different depths.
   *
   * This was one flat annulus, and once the stone opened it read as a plain
   * gold donut sitting behind the blocks — the single cheapest-looking thing
   * in the frame. What the boards reveal is STRUCTURE: rings within rings at
   * different depths with light in the channels between them. The depth has to
   * be real, because a flat band lit from an emptied sky has nothing to catch.
   */
  const core = useMemo(() => {
    const span = L.coreOut - L.coreIn
    const bands: [number, number, number][] = [
      // [innerFraction, outerFraction, z as a fraction of depth]
      [0.0, 0.3, 0.1],
      [0.38, 0.66, -0.12],
      [0.74, 1.0, 0.06],
    ]
    return merge(
      bands.map(([a, b, z]) =>
        placed(
          arcPlate(
            L.coreIn + span * a,
            L.coreIn + span * b,
            0,
            Math.PI * 2,
            L.depth * 0.55,
            0.05,
            120,
          ),
          new Vector3(0, 0, L.depth * z),
        ),
      ),
    )
  }, [L])

  /** The channels BETWEEN the bands, where the light lives. */
  const channels = useMemo(() => {
    const span = L.coreOut - L.coreIn
    return [L.coreIn + span * 0.34, L.coreIn + span * 0.7]
  }, [L])

  /*
   * Gold, but only in places.
   *
   * Trim on every block would make the metal a stripe rather than an accent.
   * The boards are disciplined about this: gold marks particular members, so
   * it reads as meaning something structural rather than as decoration.
   */
  const goldwork = useMemo(() => {
    const rng = createRng(0x22bd41)
    const parts: ReturnType<typeof placed>[] = []
    // The inner bead — a continuous ring at the lip of the opening. This is
    // the one piece of metal visible in the very first board.
    parts.push(
      placed(
        arcPlate(L.rIn * 0.972, L.rIn * 1.005, 0, Math.PI * 2, L.depth * 0.5, 0.1, 140),
        new Vector3(0, 0, L.depth * 0.16),
      ),
    )
    /*
     * NO TRIM ON THE BLOCKS.
     *
     * Short gold bars were set into a third of the voussoirs and they read as
     * slots milled into rock — a machined detail on the face of something that
     * is supposed to look like it predates machining, which gave the whole
     * arrival away. The only metal visible at rest is the bead at the lip, and
     * even that is tarnished. Everything else is inside, and stays inside
     * until the thing opens.
     */
    return merge(parts)
  }, [L, R, blocks])

  /* ------------------------------------------------------------------ *
   * RUBBLE — the ring stands in broken rock, not on a cast plinth
   * ------------------------------------------------------------------ */
  const scree = useMemo(() => {
    const rng = createRng(0x4f81c0)
    return merge(
      [-1, 1].map((side) =>
        placed(
          rubble(16, R * 0.66, R * 0.5, R * 0.115, rng),
          new Vector3(side * R * 0.56, -R * 1.12, 0),
        ),
      ),
    )
  }, [R])

  /* ------------------------------------------------------------------ *
   * Animation: one value moves the stone and lights the machine
   * ------------------------------------------------------------------ */
  const redRef = useRef<MeshStandardMaterial>(null)
  const goldRef = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    const a = MathUtils.clamp(nightLevel + charge * 0.4, 0, 1)
    // Eased, so the stone breaks free slowly and then travels.
    const e = a * a * (3 - 2 * a)

    for (let i = 0; i < blocks.length; i++) {
      const g = blockRefs.current[i]
      if (!g) continue
      const b = blocks[i]
      const d = e * b.lift * R * 0.075
      /*
       * Outward along the block's OWN radius, and back in Z.
       *
       * Moving them all in one direction would slide the ring apart; moving
       * them along their radii opens every joint at once while the circle
       * stays a circle. The small retreat in Z is what makes the gold behind
       * them visible rather than merely edge-lit.
       */
      g.position.set(Math.cos(b.mid) * d, Math.sin(b.mid) * d, b.z - d * 0.35)
    }

    const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.6)
    if (redRef.current) {
      redRef.current.emissiveIntensity = MathUtils.lerp(
        redRef.current.emissiveIntensity,
        e * (2.4 + breath * 0.4) + charge * 4,
        0.08,
      )
    }
    if (goldRef.current) {
      // Dull bronze at rest, lit from the same source as the channel once open.
      goldRef.current.emissiveIntensity = MathUtils.lerp(
        goldRef.current.emissiveIntensity,
        0.06 + e * 0.85,
        0.08,
      )
    }
  })

  const indicators = useMemo(() => {
    const rng = createRng(0x9ac3f1)
    const out: Matrix4[] = []
    for (const b of blocks) {
      if (rng() > 0.34) continue
      const r = L.rIn * 1.06
      out.push(
        new Matrix4().compose(
          new Vector3(Math.cos(b.mid) * r, Math.sin(b.mid) * r, L.depth * 0.3),
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), b.mid),
          new Vector3(1, 1, 1),
        ),
      )
    }
    return out
  }, [blocks, L])

  const setGreens = useCallback(
    (mesh: InstancedMesh | null) => {
      if (!mesh) return
      indicators.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.instanceMatrix.needsUpdate = true
    },
    [indicators],
  )

  const GOLD = '#c08f42'

  return (
    /*
     * It stands on its footing. At 0.72R the bottom third was underwater and
     * you never saw the ring meet anything, so it read as an arch sunk in the
     * sea rather than as a structure that has been here. The water still cuts
     * the scree, which is what says the sea rose around it.
     */
    <group position={[0, R * 1.05, -150]}>
      {/* ---- The machine, behind the stone ---- */}
      <mesh geometry={core}>
        <meshStandardMaterial
          ref={goldRef}
          color={GOLD}
          metalness={0.9}
          roughness={0.34}
          /*
           * Well above 1, and not arbitrarily.
           *
           * envMapIntensity multiplies the scene environment, which is dimmed
           * to about a fifth at night so stone does not glow like a sunset.
           * Metal has nothing BUT the environment — everything it shows you is
           * reflected — so without buying that back the gold renders as dark
           * brown scratches under an emptied sky.
           */
          envMapIntensity={5.5}
          emissive={GOLD}
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Light in the channels between the bands — see the core note. */}
      {channels.map((r, i) => (
        <mesh key={`ch-${i}`} position={[0, 0, -L.depth * 0.06]}>
          <torusGeometry args={[r, R * 0.011, 8, 150]} />
          <meshStandardMaterial
            color="#1a0503"
            emissive="#ff3418"
            emissiveIntensity={nightLevel * 2.2}
            metalness={0}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* The channel at the lip of the opening — the portal's actual light. */}
      <mesh position={[0, 0, L.depth * 0.1]}>
        <torusGeometry args={[L.rIn * 0.965, R * 0.016, 12, 170]} />
        <meshStandardMaterial
          ref={redRef}
          color="#1a0503"
          emissive="#ff2a12"
          emissiveIntensity={0}
          metalness={0}
          roughness={0.4}
        />
      </mesh>

      {/* ---- The stone. Eighteen blocks, each free to move. ---- */}
      {blocks.map((b, i) => (
        <group key={i} ref={setBlock(i)}>
          <mesh castShadow receiveShadow geometry={b.geo}>
            <meshStandardMaterial
              color={limestone.clone().offsetHSL(b.hue, 0, b.tint)}
              /*
               * Roughness only — NOT albedo.
               *
               * The same greyscale was briefly used as the colour map too, and
               * it tiled into a visible square grid across every block while
               * halving the stone's brightness. An albedo map advertises its
               * repeat far more loudly than a roughness map does, because the
               * eye reads lightness pattern directly and specular response
               * only indirectly. Mottled roughness gives the surface variation
               * that survives this backlit environment, without printing a
               * chequerboard on the masonry.
               */
              roughnessMap={roughMap}
              roughness={0.95}
              metalness={0}
              envMapIntensity={0.5}
              normalMap={stoneMap}
              normalScale={normalScale}
            />
          </mesh>
        </group>
      ))}

      {/* ---- Gold: the inner bead, and trim on selected blocks ---- */}
      <mesh castShadow geometry={goldwork}>
        <meshStandardMaterial
          color={GOLD}
          metalness={0.9}
          /*
           * Dull bronze until it wakes.
           *
           * At envMapIntensity 6 this bead was mirroring the whole dusk sky
           * and came out as a neon orange hoop in the middle of an otherwise
           * ancient object — the one detail that made the arrival look like a
           * toy. Tarnished metal in a ruin is nearly matte; the shine is
           * something the portal gets back when it turns on.
           */
          /*
           * Properly tarnished at rest.
           *
           * Even at roughness 0.62 this bead caught a hot specular off the low
           * sun and bloomed into a thin red-orange filament running round the
           * opening — a glowing thread in an object that is meant to be inert,
           * and the last thing in the resting shot that gave away the machine.
           * Metal that has sat in salt air for centuries is nearly matte. The
           * polish is something the portal gets back when it wakes.
           */
          envMapIntensity={0.45 + nightLevel * 5.5}
          roughness={0.88 - nightLevel * 0.55}
          emissive={GOLD}
          emissiveIntensity={0.02 + nightLevel * 0.5}
        />
      </mesh>

      {/*
        The bore: an open cylinder seen from inside, so the opening has DEPTH.
        You look down a throat rather than through a hole punched in a disc.
      */}
      <mesh position={[0, 0, -R * 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[L.rIn * 0.96, L.rIn * 0.96, R * 0.55, 96, 1, true]} />
        <meshStandardMaterial color="#0b0d0f" side={BackSide} metalness={0.4} roughness={0.9} />
      </mesh>

      {/* ---- Scree ---- */}
      <mesh castShadow receiveShadow geometry={scree}>
        <meshStandardMaterial
          color={limestone.clone().multiplyScalar(0.78)}
          /*
           * No normal map on the scree.
           *
           * An icosahedron's UVs are per-face, not world-projected, so the
           * limestone map stretched across each facet into long parallel
           * streaks — the rocks came out looking like split driftwood. The
           * faceting itself is the detail here; these are meant to read as
           * fractured blocks, and fractured blocks are flat planes meeting at
           * hard angles.
           */
          roughness={0.97}
          metalness={0}
          envMapIntensity={0.45}
        />
      </mesh>

      {/* ---- Indicators: tiny, few, and only once the thing is awake ---- */}
      <instancedMesh ref={setGreens} args={[undefined, undefined, indicators.length]}>
        <boxGeometry args={[R * 0.01, R * 0.024, R * 0.01]} />
        <meshStandardMaterial
          color="#04160b"
          emissive="#3cff88"
          emissiveIntensity={nightLevel * 3.2}
          toneMapped={false}
        />
      </instancedMesh>

      {/*
        COOL FILL, so the stone is still stone after dark.

        Nothing in this world reaches the front of the ring — the sky has been
        emptied and every other photon comes up off the water behind it. Left
        alone the blocks render as pure black, which turned the whole opening
        sequence into a sunburst of dark spikes instead of masonry lifting off
        a machine. The separation only reads if you can still see the stone.

        Kept tight with `distance` so it lights the portal and not the sea, and
        cool so the gold stays the warm thing in frame.
      */}
      {[-1, 1].map((side) => (
        <pointLight
          key={`fill-${side}`}
          position={[side * R * 1.2, R * 0.45, R * 1.3]}
          color="#a9c6e6"
          // Inverse square over seventy units is a factor of five thousand;
          // this is sized against the distance, not chosen by feel.
          intensity={nightLevel * R * R * 2.4}
          distance={R * 3.2}
          decay={2}
        />
      ))}

      {/*
        Real red light, so the channel LIGHTS the stone around it rather than
        sitting on top of it as a drawn line. Three is enough to wrap the
        opening and reach the water; more costs far more than it shows.
      */}
      {[Math.PI / 2, Math.PI * 1.22, Math.PI * 1.78].map((a, i) => (
        <pointLight
          key={`rl-${i}`}
          position={[Math.cos(a) * L.rIn * 0.9, Math.sin(a) * L.rIn * 0.9, R * 0.1]}
          color="#ff3a18"
          /*
           * Lights obey inverse square here, so intensity is not a 0-1 dial —
           * a value that looks large is ordinary once it has crossed twenty
           * units of stone.
           */
          intensity={nightLevel * R * R * 0.42}
          distance={R * 1.9}
          decay={2}
        />
      ))}
    </group>
  )
}
