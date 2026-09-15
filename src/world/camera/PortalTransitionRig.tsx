'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera as ProxyCamera, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock, portalFrame, portalTransitionActive } from '../cinematic/cinematicState'

/**
 * The flight begins while the world is still settling, not after a pause.
 * One continuous acceleration carries us from the last pillar movement through
 * the red gateway and all the way beyond the Blender bore.
 */
const T_START = 10.75
const T_HANDBACK = 14.46
const NEAR_REST = 0.35
const NEAR_BORE = 0.06

const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

/**
 * One function, no internal keyframes.
 *
 * The old piecewise smoothsteps went to zero velocity at every segment edge,
 * which is precisely why the move felt like several animations glued together.
 * This power curve has one uninterrupted derivative from start to handback:
 * forward pressure -> acceleration -> threshold -> faster bore traversal.
 */
function travelAt(t: number): number {
  const u = Math.max(0, Math.min(1, (t - T_START) / (T_HANDBACK - T_START)))
  return Math.pow(u, 1.36)
}

export function PortalTransitionRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scratch = useMemo(
    () => ({ pos: new Vector3(), aim: new Vector3(), look: new ProxyCamera() }),
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
    const active = t >= T_START && t <= 15.0 && portalFrame.measured

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

    // The only discontinuity is the hidden destination handback, and it occurs
    // after the red/black travel layer has covered the frame.
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

    // Matches the end of CinematicCamera at roughly z=38 for the measured asset.
    // We finish well beyond the physical bore so machinery genuinely passes
    // behind the lens before the abstract red-speed transition takes over.
    const startZ = c.z + 172
    const endZ = c.z - portalFrame.depth - 84
    const travelled = travelAt(t)
    const z = startZ + (endZ - startZ) * travelled

    // Y converges onto the aperture centre while Z never stops advancing.
    const centreBlend = smooth01((t - T_START) / 1.35)
    const y = 26 + (c.y - 26) * centreBlend
    scratch.pos.set(c.x, y, z)
    camera.position.copy(scratch.pos)
    camera.rotation.z = 0

    /*
     * Approach: look at the opening.
     * Crossing: migrate the target through it.
     * After crossing: the target is always far AHEAD of the camera, so the
     * camera never turns around to show the back of the machine.
     */
    const forwardBlend = smooth01((t - 12.52) / 0.72)
    const forwardAimZ = z - 260
    scratch.aim.set(
      c.x,
      c.y,
      c.z + (forwardAimZ - c.z) * Math.max(0, Math.min(1, forwardBlend)),
    )

    scratch.look.position.copy(scratch.pos)
    scratch.look.lookAt(scratch.aim)
    camera.quaternion.copy(scratch.look.quaternion)

    // A continuous widening reinforces acceleration without becoming fisheye.
    const u = Math.max(0, Math.min(1, (t - T_START) / (T_HANDBACK - T_START)))
    camera.fov = 48.5 + 8.0 * Math.pow(u, 1.45)

    const inside = z < c.z + 8 && z > c.z - portalFrame.depth - 24
    const near = inside ? NEAR_BORE : NEAR_REST
    if (camera.near !== near) camera.near = near
    camera.updateProjectionMatrix()
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
