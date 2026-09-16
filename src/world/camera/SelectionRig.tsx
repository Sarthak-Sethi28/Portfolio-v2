'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useScene } from '@/store/scene'
import { SECTIONS } from '@/content'
import { CONFIG_DEFAULTS } from '@/store/scene'
import { sectionRing } from '../geometry/layout'
import {
  cameraOwnedByCinematic,
  portalTransitionActive,
} from '../cinematic/cinematicState'
import { panelSideFor, selectionCameraActive } from '../selection/selectionState'

/**
 * A FOCUS, not a shot.
 *
 * The previous version swung the camera bodily toward whichever column you
 * picked and offset its aim by forty-odd world units to clear the panel. It
 * worked, and it was disorienting: every selection threw away the hero
 * composition and replaced it with a different photograph, so choosing two
 * pillars in a row felt like being moved around a room by someone else.
 *
 * This one is bounded by design rather than by taste. The numbers below are
 * small enough that the original framing stays plainly recognisable — the
 * horizon does not tilt, the portal keeps its place, the focal length never
 * changes — and the rising column, not the camera, is what tells you which
 * monument you chose.
 *
 * The rest pose is CAPTURED from the live camera at the moment a pillar opens,
 * not assumed. On close it eases back to exactly that and then snaps to it, so
 * no drift can accumulate across repeated open/close cycles.
 */

/** Forward dolly, world units. About a two-hundredth of the distance to the ring. */
const DOLLY = 5
/** Lateral shift of the body, world units. Deliberately smaller than the dolly. */
const SHIFT = 3.5
/** How far the gaze moves, world units at the columns' depth. */
const AIM_SHIFT = 9
const AIM_LIFT = 2

/** Seconds-ish. Opening is unhurried; closing is quicker, as briefed. */
const OPEN_RATE = 4.2
const CLOSE_RATE = 6.4

/** Below this the restore is finished and the exact captured pose is written. */
const SETTLED = 0.002

export function SelectionRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const openSection = useScene((s) => s.openSection)

  const scratch = useMemo(
    () => ({
      pos: new Vector3(),
      aim: new Vector3(),
      q: new Quaternion(),
      fwd: new Vector3(),
      right: new Vector3(),
      up: new Vector3(0, 1, 0),
    }),
    [],
  )

  const ring = useMemo(
    () => sectionRing(SECTIONS.length, CONFIG_DEFAULTS.arraySpacing),
    [],
  )

  /**
   * The exact camera the visitor had before any of this started.
   *
   * Captured once, on the transition from "nothing open" to "something open",
   * and never recaptured while a pillar is up — otherwise switching directly
   * from one pillar to another would save the OFFSET pose as home and the
   * camera would walk a little further away with every selection.
   */
  const home = useRef<{ pos: Vector3; quat: Quaternion; fov: number } | null>(null)
  const t = useRef(0)

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    // The cinematic outranks this without negotiation, and takes the camera as
    // it finds it.
    if (cameraOwnedByCinematic.value || portalTransitionActive.value) {
      t.current = 0
      home.current = null
      selectionCameraActive.value = false
      return
    }

    const index = openSection ? SECTIONS.indexOf(openSection) : -1
    const want = index >= 0 ? 1 : 0

    if (want === 1 && home.current === null) {
      home.current = {
        pos: camera.position.clone(),
        quat: camera.quaternion.clone(),
        fov: camera.fov,
      }
    }

    const rest = home.current
    if (!rest) {
      selectionCameraActive.value = false
      return
    }

    const rate = want === 1 ? OPEN_RATE : CLOSE_RATE
    t.current += (want - t.current) * (1 - Math.exp(-rate * Math.min(delta, 1 / 20)))

    if (want === 0 && t.current < SETTLED) {
      // Land on the captured pose EXACTLY, then let go. An asymptote left the
      // camera a hair off home every time, and "a hair" accumulates.
      camera.position.copy(rest.pos)
      camera.quaternion.copy(rest.quat)
      camera.fov = rest.fov
      camera.updateProjectionMatrix()
      t.current = 0
      home.current = null
      selectionCameraActive.value = false
      return
    }

    selectionCameraActive.value = true

    const placement = index >= 0 ? ring[index] : null
    const cx = placement ? placement.position[0] : 0
    // Away from the panel, so the column sits in the free half — but by a few
    // units, not by a swing.
    const push = panelSideFor(cx) === 'left' ? 1 : -1

    // The camera's own axes, so the nudge is relative to where it is looking
    // rather than to world X. That keeps this correct if the rest pose ever
    // changes.
    scratch.fwd.set(0, 0, -1).applyQuaternion(rest.quat)
    scratch.right.set(1, 0, 0).applyQuaternion(rest.quat)

    const k = t.current * t.current * (3 - 2 * t.current)

    scratch.pos
      .copy(rest.pos)
      .addScaledVector(scratch.fwd, DOLLY * k)
      .addScaledVector(scratch.right, push * SHIFT * k)
    camera.position.copy(scratch.pos)

    /*
     * Rotation is produced by moving the LOOK POINT a little, not by aiming at
     * the column. Aiming at the column is what made the old rig swing: the
     * further off-axis the column, the larger the rotation, so two pillars felt
     * like two different cameras. A fixed small offset applied to the existing
     * gaze gives every pillar the same tiny, predictable move.
     */
    scratch.aim
      .copy(rest.pos)
      .addScaledVector(scratch.fwd, 240)
      .addScaledVector(scratch.right, push * AIM_SHIFT * k)
      .addScaledVector(scratch.up, AIM_LIFT * k)

    scratch.q.copy(camera.quaternion)
    camera.lookAt(scratch.aim)
    camera.rotation.z = 0

    // FOV is never touched. Changing it is the single fastest way to make a
    // small move feel like a zoom.
    camera.fov = rest.fov
    camera.updateProjectionMatrix()
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
