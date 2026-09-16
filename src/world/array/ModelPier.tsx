'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Color, Plane, Vector3, type Group, type Mesh, type MeshStandardMaterial, type PointLight } from 'three'
import type { Placement } from '../geometry/layout'
import type { SectionId } from '@/content'
import { useScene } from '@/store/scene'
import { cinematicSample, worldNight } from '../cinematic/cinematicState'
import { waterline } from '../cinematic/waterline'
import { PILLAR_RISE } from '../selection/selectionState'
import { attract } from '../selection/attract'

/**
 * A pier from a downloaded model, on trial.
 *
 * Scaled by measuring the loaded mesh rather than guessing: an asset arrives
 * in whatever units its author used — metres, centimetres, or a scanner's
 * arbitrary scale — so the only reliable way to fit one into a world is to
 * read its bounding box and normalise against the height we actually want.
 */
/**
 * Clone a mesh's material(s), keeping the ARRAY-ness of the original.
 *
 * This mattered more than it looks. Wrapping a single material in an array
 * and assigning it back does not render at all: three draws array materials
 * by walking `geometry.groups`, and a glTF primitive has none, so the mesh
 * silently produces zero draw calls. The night columns were not dark — they
 * were not being drawn, and every attempt to fix it by raising the glow was
 * chasing the wrong number.
 */
function recolor(mesh: Mesh, edit: (m: MeshStandardMaterial) => void) {
  const was = mesh.material
  const list = (Array.isArray(was) ? was : [was]) as MeshStandardMaterial[]
  const next = list.map((mat) => {
    const copy = mat.clone()
    edit(copy)
    copy.needsUpdate = true
    return copy
  })
  mesh.material = (Array.isArray(was) ? next : next[0]) as unknown as Mesh['material']
}

export function ModelPier({
  placement,
  variant = 0,
  src = '/models/pillar.glb',
  mirrored = false,
  descentDelay = 0,
  sectionId,
}: {
  placement: Placement
  /**
   * Set only on the four navigation columns.
   *
   * Its presence is what makes a pier something you can point at: it adds the
   * pick volume, the hover response and the rise. The dozen scenery piers pass
   * nothing and stay exactly as inert as they were.
   */
  sectionId?: SectionId
  /** Which asset to use. See the note in ArrayWorld on mixing them. */
  src?: string
  /**
   * Render as a REFLECTION rather than as the object.
   *
   * The mirrored copy previously reused this component as-is, which meant it
   * shared material instances with the real world — so anything done to the
   * reflection's materials happened to the originals too. A clipping plane
   * tried that way deleted the entire city.
   *
   * With this set, the clone gets its OWN materials: darker, blue-shifted,
   * and clipped at the waterline. A reflection is an image of a thing, not a
   * second copy of it, and it has to be treated as one.
   */
  mirrored?: boolean
  /**
   * Seconds of delay before this column starts down, from the layout.
   *
   * Passed in rather than derived from an array index: the four primary
   * columns are identified by where they actually stand, so the order reads
   * far-left, far-right, near-left, near-right on screen regardless of what
   * order the layout happens to generate them in.
   */
  descentDelay?: number
  /**
   * Which part of the asset to show.
   *
   * Kitbashing: one mesh used many ways. 0 is the whole tower; 1 crops to the
   * spire alone, riding higher so only the top shows above the water, and 2
   * crops to the base, a stump with its head long gone. Games do this
   * constantly — a level with four unique meshes reads as a hundred, because
   * scale, rotation and how much of a thing you can see change it more than
   * its geometry does.
   */
  variant?: number
}) {
  const { scene } = useGLTF(src)
  const { position, rotationY, tilt, height, submerge } = placement

  /*
   * Whether this pier lights up at all — NOT how brightly.
   *
   * The clone below is keyed on this boolean rather than on `glow` itself.
   * `glow` is the night level, which the frame loop moves in small steps, so
   * keying the memo on it re-cloned the whole GLB about fifty times over a
   * single transition. The brightness is animated on the materials instead,
   * which is what materials are for.
   */
  /*
   * ALWAYS build the lit materials, even in daylight.
   *
   * This was `glow > 0`, and the clone below is keyed on it — so the instant
   * night began the boolean flipped and the entire GLB was re-cloned with
   * fresh materials, for four columns and their four mirrored copies, on one
   * frame in the middle of the day-to-night crossing. Measured in a production
   * build it was a run of thirty-to-forty millisecond frames right through the
   * beat where the sky is supposed to be changing smoothly.
   *
   * Cloning unconditionally costs one extra material per mesh at load, when
   * nothing is moving, and the emissive is driven to zero every frame in
   * daylight anyway — so the daytime appearance is identical and the
   * transition no longer has to pay for itself.
   */
  const lit = true

  const { cloned, litMaterials } = useMemo(() => {
    const c = scene.clone(true)
    const litMaterials: MeshStandardMaterial[] = []

    // Clip whatever the mirror pushes above the waterline. Only ever applied
    // to CLONED materials, never to the shared originals — doing that once
    // deleted the entire city.
    const clip = mirrored ? [new Plane(new Vector3(0, -1, 0), 0)] : null
    /*
     * Strip the scan's display plinth.
     *
     * This asset was photogrammetried in a museum and the slab it was standing
     * on came with it — visible as a dark angled box under the pier. The
     * author left it on its own material, helpfully named "bottom", so it can
     * be removed precisely rather than hidden by sinking the whole model.
     */
    c.traverse((o) => {
      const m = o as {
        isMesh?: boolean
        visible?: boolean
        castShadow?: boolean
        receiveShadow?: boolean
        material?: { name?: string }
      }
      if (!m.isMesh) return
      if (m.material?.name?.toLowerCase().includes('bottom')) {
        m.visible = false
        return
      }

      if (mirrored) {
        const mesh = o as unknown as Mesh
        recolor(mesh, (copy) => {
          // An image in water: darker, cooler, and never casting anything.
          copy.color?.multiplyScalar(0.42)
          copy.color?.lerp(new Color('#22394f'), 0.45)
          if ('envMapIntensity' in copy) copy.envMapIntensity = 0.15
          copy.clippingPlanes = clip
        })
        mesh.castShadow = false
        mesh.receiveShadow = false
        return
      }

      m.castShadow = true
      m.receiveShadow = true

      if (lit) {
        recolor(o as unknown as Mesh, (copy) => {
          /*
           * Darker stone, and a cooler flame inside it.
           *
           * The first lit pass came out terracotta — the asset's albedo is
           * already a warm sandstone, and lighting it with #ffb877 stacked
           * warm on warm until the columns read as orange plastic against a
           * blue world. Knocking the base colour down and pulling the
           * emissive back toward a dim ember keeps them the warm point in the
           * frame without making them the loudest thing in it. Stone lit from
           * inside should look like stone with a fire in it, not like a lamp.
           */
          copy.color?.multiplyScalar(0.5)
          /*
           * Desaturated, not just dimmed.
           *
           * Darkening alone kept the hue, so the columns went from orange
           * plastic to rusted iron — still the most saturated thing in a
           * frame whose entire palette is blue. The asset's albedo is already
           * warm sandstone, so the emissive has to be nearly neutral or it
           * stacks warm on warm. A pale amber reads as stone with light
           * behind it; a strong one reads as terracotta.
           */
          copy.emissive = new Color('#c8a887')
          /*
           * Masked by the stone's own texture, not painted flat over it.
           *
           * A uniform emissive ignores lighting completely, so the first
           * version that actually rendered turned each column into a solid
           * orange cutout — every trace of the muqarnas carving gone, which
           * is the entire reason for choosing this asset. Reusing the albedo
           * as the emissive mask means the light comes through where the
           * stone is pale and stays out of the cut recesses, so the carving
           * reads BECAUSE it is glowing rather than in spite of it.
           */
          copy.emissiveMap = copy.map
          // Brightness is animated below, not baked here.
          copy.emissiveIntensity = 0
          litMaterials.push(copy)
        })
      }
    })
    return { cloned: c, litMaterials }
  }, [scene, mirrored, lit])

  /*
   * Fade the lanterns up with the night.
   *
   * Enough to read as lit stone, not enough to blow out the carving. The
   * number that works is far lower than the ones tried before, because the
   * columns were never under-lit — the array-material bug above meant they
   * were not drawn at all, and each failed pass answered that by pushing the
   * intensity higher. Past about 1.2 the stone flattens into a glowing blob
   * and the muqarnas detail, which is the entire reason for this asset, goes.
   */
  const name = `${position[0].toFixed(1)}_${position[2].toFixed(1)}`
  const sink = useRef<Group>(null)
  const lampRef = useRef<PointLight>(null)

  /*
   * Three booleans, not a subscription to the whole selection.
   *
   * Each selector returns a primitive that only flips when this particular
   * column's situation changes, so choosing a pillar re-renders the one that
   * rose and the ones that must quieten — a handful of commits on a click,
   * rather than anything per frame. The animation itself is in the frame loop
   * below, where it belongs.
   */
  const isSelected = useScene((s) => sectionId !== undefined && s.openSection === sectionId)
  const isHovered = useScene((s) => sectionId !== undefined && s.hovered === sectionId)
  const someoneElseSelected = useScene(
    (s) => s.openSection !== null && s.openSection !== sectionId,
  )
  const setHovered = useScene((s) => s.setHovered)
  const openSectionPanel = useScene((s) => s.openSectionPanel)

  // Eased toward the booleans above, so nothing snaps.
  const lift = useRef(0)
  const quiet = useRef(0)
  const nudge = useRef(0)
  /*
   * Per-frame mutation of three.js objects, which the React Compiler cannot
   * model — it sees memoised values being written to and assumes a
   * render-phase mutation. See the fuller note in PortalCinematic.
   */
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    /*
     * Read the night blend here rather than receive it as a prop.
     *
     * It arrived as `glow`, a continuously changing React prop, which meant
     * every step of the blend re-rendered this component — eight times over,
     * counting the mirrored world — purely to set a number that is written on
     * the material in this callback anyway.
     */
    /*
     * SELECTION, EASED.
     *
     * A frame-rate independent approach: the same fraction of the remaining
     * distance per second regardless of how long the frame took, so a 144Hz
     * machine and a struggling one arrive together.
     */
    const ease = (from: number, to: number, perSecond: number) =>
      from + (to - from) * (1 - Math.exp(-perSecond * Math.min(delta, 1 / 20)))

    lift.current = ease(lift.current, isSelected ? 1 : 0, 5.6)
    quiet.current = ease(quiet.current, someoneElseSelected ? 1 : 0, 6.2)
    nudge.current = ease(nudge.current, isHovered && !isSelected ? 1 : 0, 9)

    const night = worldNight.value
    // The chosen column keeps its light; the others step back rather than go
    // out, because a world that switches off is a menu, not a place.
    const attention = 1 - quiet.current * 0.55
    for (const m of litMaterials) m.emissiveIntensity = night * 0.5 * attention
    if (lampRef.current) {
      lampRef.current.intensity = night * height * height * 0.42 * attention
    }

    /*
     * THE RESPONSE — the columns descend.
     *
     * Real world-space translation of the real column, not a scale and not a
     * fade: the sea takes them. They travel far enough that the portal is left
     * compositionally alone, which is the point of the beat.
     *
     * The mirrored copy renders this same component with the same placement
     * and therefore the same delay, so the reflection tracks its column
     * exactly — nothing here reaches across to the reflection to keep it in
     * step, which is what would eventually let them drift apart.
     */
    const g = sink.current
    if (!g) return
    // Envelope from the timeline, offset per column. Squared on the way in so
    // the mass is slow to start and then commits.
    /*
     * RESIST, COMMIT, SETTLE.
     *
     * A smoothstep is symmetrical and reads as a light object being eased.
     * Something this heavy fights the first quarter of the move, gives way
     * through the middle, and slows again as the crown goes under. The curve
     * below is deliberately asymmetric: slow start, long committed middle,
     * gentle arrival — and monotonic, so there is never a bounce.
     */
    const raw = Math.max(0, Math.min(1, (cinematicSample.pillarDescent - descentDelay) / 0.55))
    const d = raw < 0.25
      ? raw * raw * 2.4                                   // resisting
      : raw < 0.75
        ? 0.15 + (raw - 0.25) * 1.5                       // committed
        : 0.9 + (1 - Math.pow(1 - (raw - 0.75) * 4, 2)) * 0.1  // settling
    /*
     * THE RISE.
     *
     * Added to the descent rather than replacing it, so the two can overlap
     * without either needing to know about the other: a column caught mid-
     * cinematic simply rises from wherever the sea currently has it.
     *
     * The hover nudge is a fraction of the selection rise on purpose. Hover
     * has to be felt and not read — if you can name the distance it moved, it
     * has already become a click that did not need a click.
     */
    /*
     * The nudge, staggered along the colonnade.
     *
     * descentDelay already encodes each column's place in the line — far-left,
     * far-right, near-left, near-right — so reusing it makes the hint travel
     * across the frame as one movement rather than four columns twitching at
     * once. Deliberately smaller than the hover response: this has to be
     * noticed, not obeyed.
     */
    const offer = sectionId !== undefined
      ? Math.max(0, attract.value - descentDelay * 0.55) * 1.35
      : 0
    const risen = lift.current * PILLAR_RISE + nudge.current * 0.9 + offer * 1.15
    g.position.y = -d * height * 1.6 + risen
    // Published so the water knows where this column currently cuts the
    // surface — the interaction has to follow the real waterline, not sit at
    // a fixed point and hope.
    waterline.set(name, { x: position[0], z: position[2], depth: d, height })
  })
  /* eslint-enable react-hooks/immutability */

  // Measure, then fit: read the real bounding box and normalise to the height
  // this placement asks for.
  const scale = useMemo(() => {
    const box = new Box3().setFromObject(cloned)
    const size = new Vector3()
    box.getSize(size)
    return size.y > 0 ? height / size.y : 1
  }, [cloned, height])

  const interactive = sectionId !== undefined && !mirrored

  return (
    <group position={position} rotation={[0, rotationY, tilt]}>
      <group ref={sink}>
      {/*
        A plain box to point at, rather than the carving itself.

        Raycasting the muqarnas mesh would mean testing tens of thousands of
        triangles against the pointer on every move, for four columns, to
        answer a question a box answers exactly as well: is the pointer on this
        column. It writes no colour and no depth, so it is invisible in every
        sense except to the raycaster.

        It does NOT live on the mirrored copy — a reflection is an image, and
        you cannot click a reflection.
      */}
      {interactive && (
        <mesh
          position={[0, height * 0.06, 0]}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(sectionId)
          }}
          onPointerOut={(e) => {
            e.stopPropagation()
            setHovered(null)
          }}
          onClick={(e) => {
            e.stopPropagation()
            // Clicking the raised column again puts it back down, which is one
            // of the three ways out named in the brief.
            openSectionPanel(isSelected ? null : sectionId)
          }}
        >
          <boxGeometry args={[height * 0.42, height * 0.92, height * 0.42]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
      {/*
        A source inside the stone, not just a surface that is bright.
        
        Emissive alone cannot light anything around it — the column would glow
        while the water at its foot stayed black, which reads as a decal laid
        over the scene. A real point light in the shaft throws the falloff
        down onto the surface and picks out the columns' near faces, so they
        occupy the place rather than float on it.
      */}
      {/*
        Mounted from the start at zero intensity, and never unmounted.
        
        Gating it on the night level changed the NUMBER OF LIGHTS in the scene
        the moment night began, and light count is a shader define — every
        material in the world would have relinked its program on that frame,
        during the transition. Present from the first frame, it costs one dark
        light in daylight and guarantees the day scene already compiled the
        variant the night scene needs.
      */}
      {!mirrored && (
        <pointLight
          ref={lampRef}
          position={[0, height * 0.1, 0]}
          color="#d8b089"
          intensity={0}
          distance={height * 4}
          decay={2}
          castShadow={false}
        />
      )}
      {/*
        Sunk further than a procedural pier needs to be.

        Hiding the scan's display plinth by material name did not catch it —
        the slab is welded into the same material as the stonework, so there is
        no mesh to switch off. Dropping the model by a fixed extra fraction of
        its height puts the plinth under the surface instead, which works
        regardless of how the author organised the file.
      */}
      <primitive
        object={cloned}
        scale={scale * (variant === 1 ? 1.5 : variant === 2 ? 1.25 : 1)}
        position={[
          0,
          -height / 2 +
            submerge -
            /*
             * Into the water, not onto it.
             *
             * This has swung twice: drowned to the spire tips, then lifted
             * clear so the columns perched on the surface like furniture. The
             * middle is a base that is genuinely cut by the waterline — deep
             * enough that the foot is gone, shallow enough that the carving
             * above it is all visible.
             */
            height * (variant === 1 ? 0.3 : variant === 2 ? 0.46 : 0.085),
          0,
        ]}
      />
      </group>
    </group>
  )
}

useGLTF.preload('/models/pillar.glb')
useGLTF.preload('/models/muqarnas.glb')
