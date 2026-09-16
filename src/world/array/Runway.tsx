'use client'

import { useMemo } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'

/**
 * THE APPROACH — light on the water, running to the portal.
 *
 * Board 13 is the most cinematic frame in the set and almost none of its power
 * is the ring: it is the red strips laid across the water leading the eye in,
 * like runway lights. They do the thing a portal on an empty sea otherwise
 * cannot — give the camera a direction to be pulled ALONG. Without them the
 * final move is a camera flying at an object; with them the world is showing
 * the visitor the way, and the arrival becomes something the place does rather
 * than something the camera does.
 *
 * Deliberately parallel rather than splayed toward the ring. Perspective
 * already converges them on the portal because the portal is where the camera
 * is heading, and geometry that has been pre-converged stops looking right the
 * moment the eye is anywhere but the exact spot it was aimed at.
 *
 * Additive and flat-shaded: this is light on water, not an object floating on
 * it, so it must never take a highlight or occlude what is behind it.
 */
export function Runway({ opacity, z }: { opacity: number; z: number }) {
  // Spaced wider as they go out, so the eye reads a corridor rather than a
  // grid — the outer pairs are nearly peripheral by the time they pass.
  const lanes = useMemo(() => [6, 6 + 11, 6 + 25, 6 + 44], [])

  if (opacity <= 0.001) return null

  return (
    <group position={[0, 0.35, z]}>
      {lanes.flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${x}-${side}`}
            position={[x * side, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {/* Long and narrow. A strip this thin only reads at a grazing
                angle, which is exactly the angle the approach is shot from. */}
            <planeGeometry args={[1.6, 460]} />
            <meshBasicMaterial
              color="#ff2a12"
              transparent
              opacity={opacity}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )),
      )}
    </group>
  )
}
