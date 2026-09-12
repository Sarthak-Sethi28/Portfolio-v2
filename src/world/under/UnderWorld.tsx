'use client'

import { Silt } from './Silt'
import { Surface } from './Surface'
import { ArrayWorld } from '../array/ArrayWorld'
import type { Palette } from '../atmosphere/palette'

/**
 * The world beneath the surface — the reflection, entered.
 *
 * The city is not rebuilt here. It is the SAME ArrayWorld, mirrored through
 * the water plane, so every column and the arch itself hang downward with
 * their capitals above and their bases pointing into the dark.
 *
 * That is the whole argument for this over a separate second world:
 *
 *  - It cannot drift. Change a column upstairs and it changes down here,
 *    because it IS the same component.
 *  - It costs one transform rather than a set of new assets.
 *  - And it means the mirrored plain in the day world was never decoration.
 *    The viewer was looking at this place the entire time without knowing.
 *
 * Mirroring flips winding order, so faces would be inside-out — hence the
 * negative scale needs the renderer's side handling, which three does per
 * material. Anything that looks inverted down here is a material with
 * explicit side set, not a bug in the transform.
 */
export function UnderWorld({ palette }: { palette: Palette }) {
  return (
    <group>
      {/*
        The deep.
        
        Without this the world below the columns is a flat pale wash, because
        the sky dome is still down there being sky. Underwater, everything
        beneath you falls away into black — the absence of a floor is what
        makes a depth feel bottomless, and it is the other half of what says
        you are submerged. A large inverted dome absorbs the lower hemisphere.
      */}
      <mesh position={[0, -40, 0]}>
        <sphereGeometry args={[900, 24, 16, 0, Math.PI * 2, Math.PI / 2.6, Math.PI]} />
        <meshBasicMaterial color="#040a12" side={2} fog={false} toneMapped={false} />
      </mesh>
      {/* The surface overhead, now a ceiling. */}
      <Surface />

      {/* The city, hanging. scale Y of -1 is the entire inversion. */}
      <group scale={[1, -1, 1]}>
        <ArrayWorld palette={palette} />
      </group>

      <Silt />
    </group>
  )
}
