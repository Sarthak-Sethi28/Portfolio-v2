'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera as ProxyCamera, Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import {
  cinematicClock,
  cinematicDirection,
  portalFrame,
  portalTransitionActive,
  returnJourney,
} from '../cinematic/cinematicState'

const T_START = 10.75
const T_HANDBACK = 14.46
const NEAR_REST = 0.35
const NEAR_BORE = 0.06

const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50

/** Night -> day: a fresh FORWARD push into the same portal. */
const RETURN_APPROACH = 1.28

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function travelAt(t: number): number {
  const u = Math.max(0, Math.min(1, (t - T_START) / (T_HANDBACK - T_START)))
  return Math.pow(u, 1.36)
}

export function PortalTransitionRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scratch = useMemo(
    () => ({
      pos: new Vector3(),
      aim: new Vector3(),
      look: new ProxyCamera(),
      q: new Quaternion(),
    }),
    [],
  )
  const wasActive = useRef(false)
  const wasReturnActive = useRef(false)
  const returnStart = useRef<{
    pos: Vector3
    quat: Quaternion
    fov: number
  } | null>(null)

  useEffect(() => {
    return () => {
      camera.near = NEAR_REST
      camera.fov = HOME_FOV
      camera.updateProjectionMatrix()
      portalTransitionActive.value = false
    }
  }, [camera])

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    /*
     * NIGHT -> DAY.
     *
     * This used to be the forward rig sampled backwards. That made the whole
     * exterior visibly retreat from the gateway after the tunnel. Instead we
     * start from the held night shot and move monotonically FORWARD into the
     * red ring. Once the Blender movie covers the viewport, the day reset is
     * hidden and this live camera is no longer visible.
     */
    if (returnJourney.active && portalFrame.measured) {
      if (!wasReturnActive.current) {
        wasReturnActive.current = true
        returnStart.current = {
          pos: camera.position.clone(),
          quat: camera.quaternion.clone(),
          fov: camera.fov,
        }
      }

      returnJourney.elapsed += Math.min(delta, 1 / 20)
      portalTransitionActive.value = true
      wasActive.current = true

      const c = portalFrame.centre
      const u = Math.max(0, Math.min(1, returnJourney.elapsed / RETURN_APPROACH))
      const move = 0.18 * u + 0.82 * Math.pow(u, 1.48)
      const start = returnStart.current

      const targetX = c.x
      const targetY = c.y - 0.6
      const targetZ = c.z + 13

      if (start) {
        camera.position.set(
          start.pos.x + (targetX - start.pos.x) * move,
          start.pos.y + (targetY - start.pos.y) * move,
          start.pos.z + (targetZ - start.pos.z) * move,
        )
      } else {
        camera.position.set(targetX, targetY, targetZ)
      }

      // Look THROUGH the aperture. Blend from the exact held night orientation
      // so pressing F cannot create a one-frame snap before the push begins.
      scratch.look.position.copy(camera.position)
      scratch.look.lookAt(c.x, c.y, c.z - 180)
      const turn = smooth01(Math.min(1, u * 1.35))
      if (start) {
        scratch.q.copy(start.quat).slerp(scratch.look.quaternion, turn)
        camera.quaternion.copy(scratch.q)
      } else {
        camera.quaternion.copy(scratch.look.quaternion)
      }

      camera.rotation.z = 0
      camera.fov = (start?.fov ?? HOME_FOV) + (49.5 - (start?.fov ?? HOME_FOV)) * smooth01(u)
      camera.near = u > 0.82 ? NEAR_BORE : NEAR_REST
      camera.updateProjectionMatrix()
      return
    }

    if (wasReturnActive.current) {
      wasReturnActive.current = false
      returnStart.current = null
      camera.near = NEAR_REST
      camera.updateProjectionMatrix()
      portalTransitionActive.value = false
      wasActive.current = false
    }

    // Forward authored flight only. Return travel never samples this backwards.
    const t = cinematicClock.elapsed
    const active =
      cinematicDirection.value > 0 &&
      t >= T_START &&
      t <= 15.0 &&
      portalFrame.measured

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
    const startZ = c.z + 172
    const endZ = c.z - portalFrame.depth - 84
    const travelled = travelAt(t)
    const z = startZ + (endZ - startZ) * travelled

    const centreBlend = smooth01((t - T_START) / 1.35)
    const y = 26 + (c.y - 26) * centreBlend
    scratch.pos.set(c.x, y, z)
    camera.position.copy(scratch.pos)
    camera.rotation.z = 0

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

    const u = Math.max(0, Math.min(1, (t - T_START) / (T_HANDBACK - T_START)))
    camera.fov = 48.5 + 8.0 * Math.pow(u, 1.45)

    const inside = z < c.z + 8 && z > c.z - portalFrame.depth - 24
    camera.near = inside ? NEAR_BORE : NEAR_REST
    camera.updateProjectionMatrix()
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
