'use client'

import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { dishProfile, rimLights, strutRing } from '../geometry/dish'
import type { Palette } from '../atmosphere/palette'

/**
 * The radio telescope.
 *
 * The only pale object in a black array, which makes it the eye's destination
 * on the horizon, and the only one that is not a box. It is also the contact
 * form (spec §5a), so it is built as an articulated rig: `tilt` and `heading`
 * are driven from outside rather than baked into the geometry.
 *
 * A real dish reads as a dish because of three cues, all of which the first
 * version lacked: an OPEN truss tower rather than a solid pedestal, a defined
 * rim around the reflector, and visible radial structure on its back. Without
 * them it is a mushroom.
 */
export function Dish({
  palette,
  /*
   * Close, and clear of everything.
   *
   * Two constraints pull against each other here. It must not be occluded —
   * it was originally behind the right-hand pier, so the thing competing with
   * it for attention was also the thing hiding it. But it also cannot retreat
   * to the horizon, because this dish is the CONTACT form (spec 5a): the
   * visitor approaches it, writes into the water, and it swings down to read
   * the message and transmit. A destination has to be somewhere you can go.
   *
   * So: well right of the piers on open water, near enough to read as
   * reachable, with nothing between it and the camera.
   */
  position = [138, 0, -262],
  radius = 40,
  tilt = -0.5,
/*
   * Turned to show its FACE.
   *
   * At 2.55 radians the dish was presenting its back — the truss and the
   * underside — which is the least interesting side of the most distinctive
   * object in the world. Turned toward the camera the concave reflector reads
   * immediately, and it matters more than usual here because this dish is the
   * contact form: the visitor has to recognise it as something aimed.
   */
  heading = -0.42,
  /** 0 to 1. Lights the struts and rim during a transmission. */
  transmit = 0,
}: {
  palette: Palette
  position?: [number, number, number]
  radius?: number
  /** Radians from vertical. Negative tips the face skyward. */
  tilt?: number
  heading?: number
  transmit?: number
}) {
  const profile = useMemo(() => dishProfile(radius), [radius])
  const backStruts = useMemo(() => strutRing(18, radius * 0.62), [radius])
  const lights = useMemo(() => rimLights(14, radius * 0.985, 0.2), [radius])

  const towerHeight = radius * 1.45
  const towerHalf = radius * 0.24
  // Four legs, splayed, braced — an open frame you can see the sky through.
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  const braceLevels = [0.24, 0.52, 0.8]

  const steel = '#8e948f'
  const darkSteel = '#4a4f4e'

  return (
    <group position={position} rotation={[0, heading, 0]}>
      {/* --- open truss tower ------------------------------------------- */}
      {legs.map(([sx, sz], i) => (
        <mesh
          key={`leg-${i}`}
          position={[sx * towerHalf * 0.72, towerHeight / 2, sz * towerHalf * 0.72]}
          rotation={[sz * 0.075, 0, -sx * 0.075]}
        >
          <cylinderGeometry args={[radius * 0.017, radius * 0.026, towerHeight, 6]} />
          <meshStandardMaterial color={darkSteel} roughness={0.72} metalness={0.4} />
        </mesh>
      ))}

      {braceLevels.map((f, li) => (
        <group key={`brace-${li}`} position={[0, towerHeight * f, 0]}>
          {[0, 1].map((r) => (
            <mesh castShadow receiveShadow key={r} rotation={[0, (r * Math.PI) / 2, 0]}>
              <boxGeometry args={[towerHalf * 1.5, radius * 0.02, radius * 0.02]} />
              <meshStandardMaterial color={darkSteel} roughness={0.72} metalness={0.4} />
            </mesh>
          ))}
          {/* Diagonals — what makes a truss read as a truss at silhouette size. */}
          {[-1, 1].map((d) => (
            <mesh castShadow receiveShadow key={`d${d}`} rotation={[0, 0, d * 0.62]}>
              <boxGeometry args={[towerHalf * 1.9, radius * 0.014, radius * 0.014]} />
              <meshStandardMaterial color={darkSteel} roughness={0.75} metalness={0.35} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Azimuth turret at the top of the tower. */}
      <mesh castShadow receiveShadow position={[0, towerHeight + radius * 0.1, 0]}>
        <cylinderGeometry args={[towerHalf * 0.7, towerHalf * 0.85, radius * 0.2, 12]} />
        <meshStandardMaterial color={steel} roughness={0.62} metalness={0.45} />
      </mesh>

      {/* --- everything above the elevation axis tilts together ---------- */}
      <group position={[0, towerHeight + radius * 0.2, 0]} rotation={[tilt, 0, 0]}>
        {/* The reflector. */}
        <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <latheGeometry args={[profile, 72]} />
          <meshStandardMaterial
            color="#cdd1cd"
            roughness={0.46}
            metalness={0.34}
            side={DoubleSide}
          />
        </mesh>

        {/* Rim. A defined edge is the strongest single "this is a dish" cue. */}
        <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[radius * 0.995, radius * 0.016, 8, 80]} />
          <meshStandardMaterial color={steel} roughness={0.5} metalness={0.5} />
        </mesh>

        {/* Radial backing structure. */}
        {backStruts.map((s, i) => (
          <mesh
            key={`back-${i}`}
            position={[s.x * 0.52, -radius * 0.2, s.z * 0.52]}
            rotation={[0, -s.angle, Math.PI / 2 - 0.5]}
          >
            <cylinderGeometry args={[radius * 0.008, radius * 0.008, radius * 0.86, 5]} />
            <meshStandardMaterial
              color={darkSteel}
              roughness={0.7}
              metalness={0.38}
              emissive="#9fd4ff"
              emissiveIntensity={transmit * 2.4}
            />
          </mesh>
        ))}

        {/* Feed tripod and the receiver at the focus. */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4
          return (
            <mesh
              key={`feed-${i}`}
              position={[Math.cos(a) * radius * 0.3, radius * 0.4, Math.sin(a) * radius * 0.3]}
              rotation={[Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62]}
            >
              <cylinderGeometry args={[radius * 0.008, radius * 0.008, radius * 0.95, 5]} />
              <meshStandardMaterial color={steel} roughness={0.58} metalness={0.42} />
            </mesh>
          )
        })}
        <mesh castShadow receiveShadow position={[0, radius * 0.83, 0]}>
          <cylinderGeometry args={[radius * 0.05, radius * 0.035, radius * 0.17, 10]} />
          <meshStandardMaterial color="#e0e4e0" roughness={0.44} metalness={0.5} />
        </mesh>

        {/* Red aircraft warning lights around the rim. §5a blinks these as the
            morse channel for an outgoing transmission. */}
        {lights.map((l) => (
          <mesh castShadow receiveShadow key={l.index} position={l.position}>
            <sphereGeometry args={[radius * 0.013, 8, 8]} />
            <meshBasicMaterial color="#ff2d20" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Keeps the dish tied to the palette across the day/night blend. */}
      <mesh castShadow receiveShadow position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[towerHalf * 1.6, 24]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  )
}
