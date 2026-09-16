'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera as ProxyCamera, Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useScene } from '@/store/scene'
import { SECTIONS } from '@/content'
import { sectionRing } from '../geometry/layout'
import { CONFIG_DEFAULTS } from '@/store/scene'
import {
  cameraOwnedByCinematic,
  portalTransitionActive,
} from '../cinematic/cinematicState'
import { panelSideFor, selectionCameraActive } from '../selection/selectionState'

/**
 * The camera's answer to a chosen pillar.
 *
 * Deliberately a REFRAME and not a flight. The brief for the cinematic was a
 * journey; this is a room you are already standing in turning slightly to face
 * something. So the camera drifts a little toward the chosen column and a
 * little off-axis, leaving the opposite side of frame clear for the panel, and
 * that is the whole move. Anything bigger competes with the portal sequence,
 * and the world has only one journey in it.
 *
 * It yields completely to the cinematic: pressing F while a pillar is up must
 * never turn into two rigs writing the same camera.
 */
const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)

/** How far toward the column the body drifts, as a fraction of the gap. */
const APPROACH = 0.17
/** Lateral push away from the panel side, in world units. */
const SIDESTEP = 16
const LIFT = 4.5
/** Lateral aim offset, which is what actually moves the column across frame. */
const AIM_PUSH = 46

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

export function SelectionRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const openSection = useScene((s) => s.openSection)

  const scratch = useMemo(
    () => ({
      pos: new Vector3(),
      aim: new Vector3(),
      look: new ProxyCamera(),
      q: new Quaternion(),
      home: new Quaternion(),
    }),
    [],
  )

  /** Where each section's column stands, in the same order SECTIONS is in. */
  const ring = useMemo(
    () => sectionRing(SECTIONS.length, CONFIG_DEFAULTS.arraySpacing),
    [],
  )

  const t = useRef(0)
  const wasActive = useRef(false)

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    // The cinematic outranks this without negotiation.
    if (cameraOwnedByCinematic.value || portalTransitionActive.value) {
      t.current = 0
      selectionCameraActive.value = false
      wasActive.current = false
      return
    }

    const index = openSection ? SECTIONS.indexOf(openSection) : -1
    const want = index >= 0 ? 1 : 0

    const step = Math.min(delta, 1 / 20) * 2.1
    t.current += (want - t.current) * (1 - Math.exp(-step * 2.4))

    // Fully home, and nothing to do: hand the camera back to IdleRig and stay
    // out of the way entirely rather than writing the rest pose every frame.
    if (t.current < 0.0015 && want === 0) {
      t.current = 0
      if (wasActive.current) {
        selectionCameraActive.value = false
        wasActive.current = false
      }
      return
    }

    selectionCameraActive.value = true
    wasActive.current = true

    const placement = index >= 0 ? ring[index] : null
    const cx = placement ? placement.position[0] : 0
    const cz = placement ? placement.position[2] : -110

    /*
     * The column must land in the half the panel does not take.
     *
     * Aiming AT the column centres it, and a centred column sits under the
     * inside edge of the panel whichever side that panel is on. So the aim is
     * offset laterally instead: look to the left of the column and the column
     * moves right in frame, and vice versa. The camera body steps the same way,
     * which keeps the move reading as a turn rather than a slide.
     */
    const panelLeft = panelSideFor(cx) === 'left'
    const push = panelLeft ? -1 : 1

    scratch.pos.set(
      HOME_POS.x + (cx - HOME_POS.x) * APPROACH + push * SIDESTEP,
      HOME_POS.y + LIFT,
      HOME_POS.z + (cz - HOME_POS.z) * APPROACH,
    )

    const k = smooth01(t.current)
    camera.position.lerpVectors(HOME_POS, scratch.pos, k)

    scratch.look.position.copy(HOME_POS)
    scratch.look.lookAt(HOME_TARGET)
    scratch.home.copy(scratch.look.quaternion)

    // Offset the aim, not the column. AIM_PUSH is in world units at the
    // column's depth; it is what decides how far into the free half it lands.
    scratch.aim.set(cx + push * AIM_PUSH, 22, cz)
    scratch.look.position.copy(camera.position)
    scratch.look.lookAt(scratch.aim)

    scratch.q.copy(scratch.home).slerp(scratch.look.quaternion, k)
    camera.quaternion.copy(scratch.q)
    camera.rotation.z = 0
    camera.updateProjectionMatrix()
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
