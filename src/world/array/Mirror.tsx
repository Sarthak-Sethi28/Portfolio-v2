'use client'

import { type ReactNode } from 'react'

/**
 * The reflection, as geometry.
 *
 * The real reflector is gone: it re-rendered the whole scene every frame from
 * a mirrored camera, and when that pass landed late the water lost its light
 * for a frame — the black flash that cost this project most of a day. Bisect
 * proved it, so it is not coming back.
 *
 * But half the power of the reference frames IS the mirror: every column
 * doubled, the arch's base reflected, a specular path laid down the water.
 * Without it the plain is a dark floor rather than a surface.
 *
 * So the reflection is drawn as a MIRRORED COPY of the same geometry, flipped
 * through the waterline. No second camera, no render target, nothing that can
 * arrive late — one extra draw per object instead of re-rendering the world.
 *
 * Two details make it read rather than look like a duplicate:
 *
 *  - It sits BELOW the water plane, which is semi-transparent, so what you see
 *    is the reflection through the surface rather than beside it.
 *  - Mirroring reverses winding order, so front faces become back faces. The
 *    copy therefore renders with its sides swapped; anything that looks
 *    inside-out down there is a material with an explicit `side`, not a fault
 *    in the transform.
 */
export function Mirror({ children }: { children: ReactNode }) {
  return (
    <group
      scale={[1, -1, 1]}
      // Just under the surface. Exactly at 0 the two would z-fight along the
      // waterline; a hair below leaves the surface unambiguously on top.
      position={[0, -0.12, 0]}
    >
      {children}
    </group>
  )
}
