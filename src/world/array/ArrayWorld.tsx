'use client'

import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, type Texture } from 'three'
import { useThree } from '@react-three/fiber'
import { SECTIONS } from '@/content'
import { useScene } from '@/store/scene'
import { scatterField, sectionRing } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { Monolith } from './Monolith'
import { Pier } from './Pier'
import { ModelPier } from './ModelPier'
import { DishModel } from './DishModel'
import { Dish } from './Dish'
import { Aperture } from './Aperture'
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
/**
 * How many scattered piers may carry carved bays.
 *
 * A COUNT, not a radius. Each bay is three extruded plates and seven meshes,
 * and putting them on every pier once collapsed the frame rate outright. A
 * radius bounds nothing — raise the density slider and the carved count rises
 * with it — whereas a fixed budget spent on the nearest piers is stable
 * whatever the world is set to. Everything past it is deep enough in fog that
 * an opening would be a few pixels of mush.
 */
const CARVED_BUDGET = 12

export function ArrayWorld({ palette }: { palette: Palette }) {
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
  const field = useMemo(
    () => scatterField(config.fieldDensity, config.arraySpacing),
    [config.fieldDensity, config.arraySpacing],
  )

  // The indices of the nearest piers, which are the ones worth carving.
  const carved = useMemo(() => {
    const byDistance = field
      .map((p, i) => ({ i, d: Math.hypot(p.position[0], p.position[2]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, CARVED_BUDGET)
    return new Set(byDistance.map((e) => e.i))
  }, [field])

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
        return <ModelPier key={id} placement={placement} variant={0} src={src} />
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
          // Alternating out to the horizon, so the distance is mixed too.
          src={i % 3 === 0 ? '/models/muqarnas.glb' : '/models/pillar.glb'}
        />
      ))}

      <Aperture palette={palette} stone={stoneNormal} />
      {/* The telescope, well clear on the right and near enough to approach. */}
      {/*
        Left of the axis, not right.
        
        There is no room on the right: the column sits at 23 degrees off the
        view axis and occludes everything inside about 28, while the lens only
        sees 25. Every attempt to place the dish there either hid it behind
        the column or pushed it out of frame. The left side has the depth.
      */}
      {/*
        DISH DISABLED pending diagnosis.

        The Garecra satellite dish renders as a flat grey slab rather than a
        telescope. It survived four placements and two decimation passes —
        0.01 and 0.0008 simplify error — with the same result, so this is not
        over-compression, which was the first assumption. Most likely the
        asset's parts sit in a node hierarchy that the optimiser's prune step
        flattens wrongly, or its geometry is one merged mesh that simplifies
        into rubble whatever the tolerance.

        Diagnosis is to load the raw scene.gltf directly, before any
        processing, and see whether it is right there. That separates the
        asset from our pipeline in one step, and until it is answered a broken
        object is worse than an absent one.
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
