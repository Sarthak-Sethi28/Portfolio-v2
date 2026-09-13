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
  radius = 60,
  charge = 0,
}: {
  palette: Palette
  /** Shared limestone normal map, loaded once by ArrayWorld. */
  stone?: Texture
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
      depth: R * 0.26,
      // The machine beneath, slightly smaller so the stone covers it at rest.
      coreOut: R * 0.985,
      coreIn: R * 0.685,
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
    t.repeat.set(0.11, 0.11)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stone, maxAniso])

  // Enough to roughen the surface, not enough to relight it. At 1.8 the map's
  // low-frequency lumps swung whole blocks between sky and ground colour.
  const normalScale = useMemo(() => new Vector2(0.5, 0.5), [])

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
    const joint = 0.022
    const rng = createRng(0x7c31a9)
    const out: {
      geo: ReturnType<typeof arcPlate>
      mid: number
      tint: number
      lift: number
    }[] = []
    let a = -Math.PI / 2
    for (let i = 0; i < BLOCKS; i++) {
      const sweep = (Math.PI * 2 * W[i]) / total
      const span = sweep * (1 - joint)
      // Radii barely move: an arch only holds together if its stones share a
      // circle. The variation goes into depth, which reads as different hands
      // cutting without disturbing the geometry that matters.
      const d = L.depth * range(rng, 0.9, 1.12)
      out.push({
        geo: arcPlate(L.rIn, L.rOut, a + sweep * joint * 0.5, span, d, 0.05),
        mid: a + sweep / 2,
        // Real ashlar varies far less than intuition says; at +/-0.1 this read
        // as a checkerboard rather than as one ring.
        tint: range(rng, -0.03, 0.025),
        // How far this block travels when the gate opens. Uneven on purpose —
        // a mechanism that moves in perfect lockstep looks like a screensaver.
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
    for (const b of blocks) {
      if (rng() > 0.38) continue
      const mid = (L.rIn + L.rOut) / 2
      parts.push(
        placed(
          chamferBox((L.rOut - L.rIn) * 0.7, R * 0.026, L.depth * 0.3, R * 0.006),
          new Vector3(Math.cos(b.mid) * mid, Math.sin(b.mid) * mid, L.depth * 0.52),
          b.mid,
        ),
      )
    }
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
      g.position.set(Math.cos(b.mid) * d, Math.sin(b.mid) * d, -d * 0.35)
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
              color={limestone.clone().offsetHSL(0, 0, b.tint)}
              roughness={0.93}
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
          roughness={0.33}
          envMapIntensity={6}
          emissive={GOLD}
          // Dull metal at rest. A gold ring already glowing in the first shot
          // gives away that there is a machine here before anything has woken.
          emissiveIntensity={0.04 + nightLevel * 0.5}
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
          color={limestone.clone().multiplyScalar(0.72)}
          roughness={0.97}
          metalness={0}
          envMapIntensity={0.45}
          normalMap={stoneMap}
          normalScale={normalScale}
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
