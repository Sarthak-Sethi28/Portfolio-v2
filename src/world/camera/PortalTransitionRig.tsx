'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera as ProxyCamera, Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock } from '../cinematic/cinematicState'
import { portalFrame, portalTransitionActive } from '../cinematic/cinematicState'

/** Frames 12 to 15, in seconds on the master clock. */
const T_START = 11.9
const T_END = 15.0

/** The camera's resting near plane, restored on the way out. */
const NEAR_REST = 0.35
/**
 * Near plane while inside the bore.
 *
 * Mechanical geometry passes within a fraction of a unit of the lens down
 * there, and at 0.35 it would be clipped away exactly when it should be
 * rushing past the edges of frame — the tunnel would appear to dissolve at the
 * moment it matters most.
 */
const NEAR_BORE = 0.06

/**
 * The signed-off destination pose, and the moment the camera is returned to it.
 *
 * Having flown the length of the bore the camera is a long way behind the
 * portal facing away from the world, and there is no move back to the
 * destination worth watching. So it does not make one: at 14.7 the veil is
 * effectively opaque and the camera is simply placed. A pure time condition,
 * not a callback, so a scrub to 14.8 shows exactly what playback shows.
 */
const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50
const T_HANDBACK = 14.7

/**
 * ONE velocity curve: slow, accelerate, fastest at the threshold, then coast.
 *
 * Expressed as a single monotonic function of normalised progress rather than
 * as a sequence of separate moves, because the previous flight read as several
 * disconnected animations stitched together. Nothing resets between frames 12,
 * 13, 14 and 15 — there is one position along one axis, and only its rate
 * changes.
 */
function velocityCurve(u: number): number {
  if (u <= 0.12) {
    // 12: held. The portal is already fully active; the shot is still.
    return 0
  }
  if (u <= 0.47) {
    // 13: the dolly begins. Gentle, so the pull is felt before it is seen.
    const x = (u - 0.12) / 0.35
    return 0.16 * (x * x)
  }
  if (u <= 0.76) {
    // 14: acceleration into the aperture.
    const x = (u - 0.47) / 0.29
    return 0.16 + 0.52 * (x * x * (3 - 2 * x))
  }
  if (u <= 0.9) {
    // Crossing the threshold, fastest here.
    const x = (u - 0.76) / 0.14
    return 0.68 + 0.26 * x
  }
  // 15: coasting into the dark, decelerating.
  const x = (u - 0.9) / 0.1
  return 0.94 + 0.06 * (1 - (1 - x) * (1 - x))
}

/**
 * The flight through the portal — frames 12 to 15.
 *
 * THE PORTAL DOES NOT MOVE. It is not scaled, morphed, swapped or duplicated,
 * and no second tunnel is drawn in front of the lens. Everything the viewer
 * sees growing is growing because the camera is physically closer to it, and
 * everything that rushes past inside the bore is the asset's own geometry seen
 * in real perspective.
 */
export function PortalTransitionRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  const scratch = useMemo(
    () => ({ pos: new Vector3(), aim: new Vector3(), look: new ProxyCamera(), q: new Quaternion() }),
    [],
  )
  const wasActive = useRef(false)

  useEffect(() => {
    return () => {
      camera.near = NEAR_REST
      camera.updateProjectionMatrix()
      portalTransitionActive.value = false
    }
  }, [camera])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const t = cinematicClock.elapsed
    const active = t >= T_START && t <= T_END && portalFrame.measured

    if (!active) {
      if (wasActive.current) {
        // Hand the camera back exactly as it was found.
        camera.near = NEAR_REST
        camera.updateProjectionMatrix()
        portalTransitionActive.value = false
        wasActive.current = false
      }
      return
    }

    portalTransitionActive.value = true
    wasActive.current = true

    if (t >= T_HANDBACK) {
      camera.near = NEAR_REST
      camera.fov = HOME_FOV
      camera.position.copy(HOME_POS)
      scratch.look.position.copy(HOME_POS)
      scratch.look.lookAt(HOME_TARGET)
      camera.quaternion.copy(scratch.look.quaternion)
      camera.rotation.z = 0
      camera.updateProjectionMatrix()
      return
    }

    const u = (t - T_START) / (T_END - T_START)
    const travelled = velocityCurve(u)

    const c = portalFrame.centre
    /*
     * The whole flight is one straight line along the portal's own axis.
     *
     * It starts well in front of the aperture and finishes past the back of
     * the bore, so the camera genuinely leaves the machine behind rather than
     * stopping inside it. Distances come from the asset: `depth` is how far
     * the tunnel actually runs.
     */
    const startZ = c.z + 150
    const endZ = c.z - portalFrame.depth - 40
    const z = startZ + (endZ - startZ) * travelled

    // Locked to the aperture's own centre line. No lateral drift, no orbit.
    scratch.pos.set(c.x, c.y, z)
    camera.position.copy(scratch.pos)
    camera.rotation.z = 0

    /*
     * THE LOOK TARGET MUST NOT BE THE PORTAL ONCE WE ARE PAST IT.
     *
     * Aiming at the portal's centre works right up until the camera crosses
     * its plane — after which "look at the portal" means look BACKWARDS, and
     * the camera would spin a half turn at the exact moment of the threshold
     * and show the machine receding. So the aim migrates: the aperture while
     * approaching, and a point far ahead along the travel axis from the
     * crossing onward. It never turns around.
     */
    const crossing = Math.max(0, Math.min(1, (c.z + 12 - z) / 36))
    scratch.aim.set(
      c.x,
      c.y,
      crossing < 1 ? c.z * (1 - crossing) + (z - 220) * crossing : z - 220,
    )

    scratch.look.position.copy(scratch.pos)
    scratch.look.lookAt(scratch.aim)
    camera.quaternion.copy(scratch.look.quaternion)

    /*
     * Pull the near plane in only while it is needed, and put it back after.
     *
     * A permanently tiny near plane costs depth precision across the whole
     * scene, which shows up as z-fighting on the water and the columns — a
     * real regression paid for a benefit that lasts two seconds.
     */
    const inside = z < c.z + 6 && z > c.z - portalFrame.depth - 20
    const near = inside ? NEAR_BORE : NEAR_REST
    if (camera.near !== near) {
      camera.near = near
      camera.updateProjectionMatrix()
    }
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
