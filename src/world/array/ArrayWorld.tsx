'use client'

import { useEffect, useMemo } from 'react'
import { SECTIONS } from '@/content'
import { useScene } from '@/store/scene'
import { scatterField, sectionRing } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { Monolith } from './Monolith'
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
export function ArrayWorld({ palette }: { palette: Palette }) {
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

  return (
    <group>
      {/* Navigation masses are the objects the camera sees close enough for
          architectural micro-detail to matter, so they receive the hero mesh
          treatment. Keeping the distant scatter lean protects 120 Hz. */}
      {sections.map((placement, i) => {
        const id = SECTIONS[i]
        return (
          <Monolith
            key={id}
            placement={placement}
            palette={palette}
            hero
            emphasis={hovered === id ? 1 : 0}
            onPointerOver={() => setHovered(id)}
            onPointerOut={() => setHovered(null)}
            onClick={() => openSectionPanel(id)}
          />
        )
      })}

      {field.map((placement, i) => (
        <Monolith key={`field-${i}`} placement={placement} palette={palette} />
      ))}

      <Aperture palette={palette} />
      <Dish palette={palette} />
      <Figure palette={palette} position={[21, 0, -205]} />
    </group>
  )
}
