'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'

/**
 * Pixel-stable resting camera.
 *
 * The old rig moved continuously even when the visitor did nothing. That made
 * every hard edge in the scene cross sub-pixel boundaries forever, which is
 * exactly when the motion shimmer/flicker appeared. The rendered scene itself
 * is stable; the permanent camera drift was forcing a new sampling phase every
 * frame.
 *
 * This rig keeps the camera body completely fixed at rest. Pointer movement
 * only nudges the LOOK TARGET, and a dead-zone + snap-to-rest means the camera
 * becomes mathematically still again as soon as input settles.
 */

/**
 * Elevated and pulled back, looking slightly DOWN.
 *
 * The old rig sat about a metre above the water aiming up past the piers,
 * which is dramatic but crops them — you never see a whole pier, and the array
 * reads as fragments. From above you can follow each shaft from cornice to
 * waterline, and the plain opens out behind them instead of being a sliver at
 * the bottom of frame.
 */
const REST = new Vector3(0, 34, 132)
const TARGET = new Vector3(0, 30, -110)

const POINTER_DEADZONE = 0.08
const AIM_X = 1.1
const AIM_Y = 0.45
const AIM_DAMPING = 4.5
const SNAP_EPSILON = 0.001

function deadzoned(value: number): number {
  const a = Math.abs(value)
  if (a <= POINTER_DEADZONE) return 0

  const n = Math.min(1, (a - POINTER_DEADZONE) / (1 - POINTER_DEADZONE))
  // Smoothstep keeps the edge of the dead-zone from producing a tiny jerk.
  const eased = n * n * (3 - 2 * n)
  return Math.sign(value) * eased
}

export function IdleRig() {
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const freelook = useScene((s) => s.freelook)
  const still = useScene((s) => s.flags.still)
  const closeup = useScene((s) => s.flags.closeup)

  const aim = useRef(TARGET.clone())
  const desired = useRef(TARGET.clone())
  const applied = useRef(TARGET.clone())
  const initialized = useRef(false)
  const wasFreelook = useRef(false)

  useFrame((_, delta) => {
    if (freelook) {
      wasFreelook.current = true
      return
    }

    // Re-entering from freelook should always return to a known, stable frame.
    if (!initialized.current || wasFreelook.current) {
      camera.position.copy(REST)
      aim.current.copy(TARGET)
      desired.current.copy(TARGET)
      applied.current.copy(TARGET)
      camera.lookAt(TARGET)
      initialized.current = true
      wasFreelook.current = false
    }

    // Inspection framing: close enough to judge whether the stonework holds up.
    if (closeup) {
      camera.position.set(6, 44, -66)
      camera.lookAt(0, 44, -150)
      return
    }

    if (reducedMotion || still) {
      if (camera.position.distanceToSquared(REST) > 1e-12) camera.position.copy(REST)
      if (applied.current.distanceToSquared(TARGET) > 1e-12) {
        aim.current.copy(TARGET)
        desired.current.copy(TARGET)
        applied.current.copy(TARGET)
        camera.lookAt(TARGET)
      }
      return
    }

    // The camera itself never translates during idle interaction. Translation
    // creates parallax across the whole frame and was the strongest shimmer
    // amplifier. We only move the gaze target a small amount.
    const px = deadzoned(pointer.x)
    const py = deadzoned(pointer.y)

    desired.current.set(
      TARGET.x + px * AIM_X,
      TARGET.y + py * AIM_Y,
      TARGET.z,
    )

    aim.current.x = MathUtils.damp(aim.current.x, desired.current.x, AIM_DAMPING, delta)
    aim.current.y = MathUtils.damp(aim.current.y, desired.current.y, AIM_DAMPING, delta)
    aim.current.z = TARGET.z

    // MathUtils.damp approaches asymptotically. Without this snap the camera
    // would technically keep moving forever by microscopic amounts, which is
    // exactly what we are trying to eliminate.
    if (Math.abs(aim.current.x - desired.current.x) < SNAP_EPSILON) {
      aim.current.x = desired.current.x
    }
    if (Math.abs(aim.current.y - desired.current.y) < SNAP_EPSILON) {
      aim.current.y = desired.current.y
    }

    if (camera.position.distanceToSquared(REST) > 1e-12) camera.position.copy(REST)

    // Do not rewrite the camera matrix when nothing has changed. At rest this
    // becomes a genuinely static camera, not just a very slowly moving one.
    if (aim.current.distanceToSquared(applied.current) > 1e-8) {
      camera.lookAt(aim.current)
      applied.current.copy(aim.current)
    }
  })

  return null
}
