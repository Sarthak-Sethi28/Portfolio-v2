'use client'

import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, type Texture } from 'three'
import { useThree } from '@react-three/fiber'
import { SECTIONS } from '@/content'
import { useScene } from '@/store/scene'
import { scatterField, sectionRing } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { Pier } from './Pier'
import { ModelPier } from './ModelPier'
import { PortalFinal } from '../cinematic/PortalFinal'
import { Figure } from './Figure'

/**
 * World 1 — the array.
 *
 * Assembly only: it places what the layout functions compute and wires clicks
 * into the store. No geometry maths lives here, which keeps the placement
 * rules testable without a renderer.
 */
/**
 * Textures are loaded HERE, once, and handed to every pier.
 *
 * They used to be loaded inside each Monolith. drei caches, so that is cheap —
 * but every one of those calls can suspend, and they all sit inside a single
 * <Suspense fallback={null}>. One pier suspending for a single frame therefore
 * unmounts the entire world and paints nothing: a black flash, triggered by
 * interaction, which is exactly the reported symptom. Loading once in the
 * parent means there is only one suspension, before anything is on screen.
 */


export function ArrayWorld({
  palette,
  mirrored = false,
}: {
  palette: Palette
  mirrored?: boolean
}) {
  // Columns light from within as night arrives — see ModelPier's glow note.
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const [stoneNormal, stoneRough] = useTexture(
    ['/stone-normal.jpg', '/stone-rough.jpg'],
    (loaded) => {
      const list = (Array.isArray(loaded) ? loaded : [loaded]) as Texture[]
      for (const t of list) {
        t.wrapS = RepeatWrapping
        t.wrapT = RepeatWrapping
        t.anisotropy = maxAniso
      }
    },
  ) as Texture[]

  const flags = useScene((s) => s.flags)
  const config = useScene((s) => s.config)
  const hovered = useScene((s) => s.hovered)
  const setHovered = useScene((s) => s.setHovered)
  const openSectionPanel = useScene((s) => s.openSectionPanel)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])

  const sections = useMemo(
    () => sectionRing(SECTIONS.length, config.arraySpacing),
    [config.arraySpacing],
  )

  /*
   * Which column goes down when, decided by where each one STANDS.
   *
   * The brief asks for far-left, far-right, near-left, near-right at a sixth
   * of a second apart, and that is a statement about the picture rather than
   * about the layout's internal ordering. Sorting by depth and then by side
   * means the wave reads correctly on screen even if sectionRing is later
   * changed to emit its placements in another order — keying off array indices
   * would look right today and silently scramble the moment it is.
   *
   * Delays are expressed against the descent envelope rather than in seconds,
   * so retiming the beat in the timeline retimes the stagger with it.
   */
  const descentDelays = useMemo(() => {
    const order = sections
      .map((p, i) => ({ i, x: p.position[0], z: p.position[2] }))
      .sort((a, b) => (a.z - b.z) || (a.x - b.x))
    const delays = new Array<number>(sections.length).fill(0)
    order.forEach((entry, rank) => {
      // 3.80 / 4.00 / 4.20 / 4.40 against a 1.8s envelope starting at 3.8.
      delays[entry.i] = rank * (0.2 / 1.8)
    })
    return delays
  }, [sections])
  const field = useMemo(
    () => scatterField(config.fieldDensity, config.arraySpacing),
    [config.fieldDensity, config.arraySpacing],
  )

  /*
   * The carved-bay budget is retired.
   *
   * It capped how many procedural piers got arched openings, because each was
   * three extruded plates and seven meshes and putting them everywhere
   * collapsed the frame rate. Every pier is a downloaded mesh now and brings
   * its own carving, so there is nothing left to budget.
   */

  return (
    <group>
      {/* Navigation. One monolith per section, always present. */}
      {sections.map((placement, i) => {
        const id = SECTIONS[i]
        // Every section pier is the real mesh, cropped differently per slot.
        /*
         * Two traditions, deliberately mixed.
         *
         * The pair flanking the aperture are muqarnas columns — Islamic
         * carved work — and the ones set back are gothic spires. A drowned
         * city built by one hand reads as one asset repeated; a city that
         * held more than one architecture reads as a place with a history.
         * It also solves the practical problem: different silhouettes stop
         * the eye noticing it is looking at the same mesh.
         *
         * Columns flank because that is what a column is for.
         */
        // All four are the same order. A colonnade is one column repeated —
        // mixing traditions along a single line would read as an accident.
        const src = '/models/muqarnas.glb'
        return <ModelPier key={id} placement={placement} variant={0} src={src} mirrored={mirrored} descentDelay={descentDelays[i]} />
        return (
          <Pier
            key={id}
            placement={placement}
            palette={palette}
            emphasis={hovered === id ? 1 : 0}
            onPointerOver={() => setHovered(id)}
            onPointerOut={() => setHovered(null)}
            onClick={() => openSectionPanel(id)}
            stoneNormal={stoneNormal}
            stoneRough={stoneRough}
          />
        )
      })}

      {/* Scenery. Count is slider-driven and may legitimately be zero.
          These take no emphasis, so with Monolith memoised they do not
          re-render when the hovered section changes. */}
      {/* Distant ruins: the same asset again, cropped and scaled so a dozen
          silhouettes never read as one object repeated. */}
      {field.map((placement, i) => (
        <ModelPier
          key={`field-${i}`}
          placement={placement}
          variant={(i + 1) % 3}
          mirrored={mirrored}
          // Alternating out to the horizon, so the distance is mixed too.
          src={i % 3 === 0 ? '/models/muqarnas.glb' : '/models/pillar.glb'}
        />
      ))}

      {!flags.noGate && <PortalFinal />}
      {/* The telescope, well clear on the right and near enough to approach. */}
      {/*
        Left of the axis, not right.
        
        There is no room on the right: the column sits at 23 degrees off the
        view axis and occludes everything inside about 28, while the lens only
        sees 25. Every attempt to place the dish there either hid it behind
        the column or pushed it out of frame. The left side has the depth.
      */}
      {/*
        No dish.

        Removed on request. The asset works now — the fault was an axis
        correction added on assumption, not compression — and DishModel is
        kept so it can come back without redoing any of that. The note in
        DishModel records why it needs no rotation.
      */}


      {/*
        Dish hidden.

        It is a lathed ellipse standing next to photogrammetried stone, and
        that gap reads immediately — it was the least convincing thing in the
        frame and it kept colliding with the right-hand tower whichever way it
        was moved. It comes back when it can be a real mesh, or a modelled
        radio telescope sourced the same way as the towers.

        It matters more than scenery: the dish is the contact form (spec 5a),
        so it has to be the best object in the world, not the worst.
      */}

      {/* Scale reference. See Figure — nothing else in the world has a size
          the viewer already knows. */}
      <Figure palette={palette} position={[21, 0, -205]} />
    </group>
  )
}
