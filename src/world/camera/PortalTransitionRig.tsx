'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera as ProxyCamera, Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock, portalFrame, portalTransitionActive } from '../cinematic/cinematicState'

/** Storyboard timing: 12 approach, 13 aperture, 14 transition, 15 destination. */
const T_START = 11.85
const T_END = 15.0
const T_CROSS_FRONT = 13.0
const T_LEAVE_BORE = 13.82
const T_HANDBACK = 14.48

const NEAR_REST = 0.35
const NEAR_BORE = 0.06

const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function between(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

/**
 * One continuous distance function, authored around the ACTUAL portal plane.
 *
 * `cross` is the fraction of the whole flight at which z == aperture z. The
 * previous implementation used a generic normalised velocity curve, so the
 * camera did not reach the front face until ~14.3 even though the storyboard's
 * THROUGH THE APERTURE frame is 13.0. This curve makes the physical crossing
 * happen at 13.0 regardless of the GLB's measured bore depth.
 */
function travelAt(t: number, cross: number): number {
  if (t <= 12.05) return 0

  if (t <= 12.65) {
    // The pull becomes visible, but we still have time to read the whole gateway.
    return cross * 0.46 * between(t, 12.05, 12.65)
  }

  if (t <= T_CROSS_FRONT) {
    // Commit to the threshold. Speed is rising here, not resetting.
    const x = between(t, 12.65, T_CROSS_FRONT)
    return cross * 0.46 + cross * 0.54 * x
  }

  if (t <= T_LEAVE_BORE) {
    // The Blender payoff: spend almost a full second physically inside it.
    const x = between(t, T_CROSS_FRONT, T_LEAVE_BORE)
    return cross + (0.93 - cross) * x
  }

  if (t <= 14.22) {
    // Coast through the final depth before the abstract black/red transition.
    const x = between(t, T_LEAVE_BORE, 14.22)
    return 0.93 + 0.07 * x
  }

  return 1
}

/**
 * Frames 12 -> 15 are one shot. The portal is already fully active; from this
 * point on NOTHING about the portal scales, morphs, swaps or respawns. The
 * camera travels down the centre line of the real GLB bore.
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
      camera.fov = HOME_FOV
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
        camera.near = NEAR_REST
        camera.updateProjectionMatrix()
        portalTransitionActive.value = false
        wasActive.current = false
      }
      return
    }

    portalTransitionActive.value = true
    wasActive.current = true

    // Destination handback happens only while Frame 15 is already essentially
    // black. There is no visible reverse flight back through the portal.
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

    const c = portalFrame.centre
    const startZ = c.z + 150
    const endZ = c.z - portalFrame.depth - 36
    const distance = startZ - endZ
    const cross = Math.max(0.05, Math.min(0.9, (startZ - c.z) / distance))
    const travelled = travelAt(t, cross)
    const z = startZ + (endZ - startZ) * travelled

    // Match the preceding shot's lower camera, then settle exactly onto the
    // aperture centre line before the threshold. That removes the vertical snap
    // the old rig introduced at 11.9s.
    const centreY = 26 + (c.y - 26) * between(t, T_START, 12.60)
    scratch.pos.set(c.x, centreY, z)
    camera.position.copy(scratch.pos)
    camera.rotation.z = 0

    /*
     * Before the threshold, the aperture is the subject. During the threshold,
     * the aim migrates through it. After the crossing, the target stays FAR IN
     * FRONT of the camera — never back at the portal — so there is no backside
     * flip as soon as z passes the ring plane.
     */
    const forwardBlend = between(t, 12.82, 13.18)
    const forwardAimZ = z - 220
    scratch.aim.set(c.x, c.y, c.z + (forwardAimZ - c.z) * forwardBlend)

    scratch.look.position.copy(scratch.pos)
    scratch.look.lookAt(scratch.aim)
    camera.quaternion.copy(scratch.look.quaternion)

    // A tiny widening is enough to sell speed. Translation, not FOV pumping,
    // remains responsible for almost all apparent growth.
    const flightFov = 48.5 + between(t, 12.55, 13.45) * 3.5
    if (Math.abs(camera.fov - flightFov) > 0.001) camera.fov = flightFov

    const inside = z < c.z + 7 && z > c.z - portalFrame.depth - 18
    const near = inside ? NEAR_BORE : NEAR_REST
    if (camera.near !== near) camera.near = near
    camera.updateProjectionMatrix()
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
