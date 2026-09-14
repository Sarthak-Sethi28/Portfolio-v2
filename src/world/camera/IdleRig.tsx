'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'
import { sample } from '../sequence'

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
/*
 * Near the surface.
 *
 * Reflections are strongest at GRAZING angles. From 34 units up you look INTO
 * water and see almost nothing; from just above it you look OFF it and the
 * columns become long vertical streaks — which is exactly how the reference
 * frames get their power, and why their camera sits where it does.
 */
const REST = new Vector3(0, 9, 128)
/*
 * The height of the portal's opening, so the camera can pass THROUGH it.
 *
 * Derived from how ModelAperture is placed: it sits at y = -10 and stands 84
 * units tall, so the centre of the ring is 32 above the water. Aiming anywhere
 * else and the last move clips the structure instead of threading it.
 */
const GATE_Y = 32
const TARGET = new Vector3(0, 26, -110)

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
  const under = useScene((s) => s.flags.under)
  const sequence = useScene((s) => s.sequence)

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

    /*
     * Beneath the surface, looking UP.
     *
     * Height is the whole read: too shallow and the ceiling fills the frame,
     * too deep and the hanging city is lost in the murk. This sits low enough
     * to see the columns descending past the lens and still catch the
     * membrane above them.
     */
    /*
     * THE SEQUENCE OWNS THE CAMERA.
     *
     * Checked before every resting behaviour, including `still` and reduced
     * motion, because those exist to stop IDLE drift — the thing that was
     * making hard edges cross sub-pixel boundaries forever — and not to
     * forbid deliberate movement. Freezing the camera through the one move
     * the whole site is built around would be obeying the letter of that fix
     * and losing the reason for it.
     *
     * Two travels with a long hold between them. The first pushes in from the
     * wide arrival to a station where the ring fills the frame, and then STOPS
     * — every mechanical beat, the unlock and the ignition, plays from a
     * locked-off camera, because a shot that keeps creeping while something is
     * happening tells the viewer the movement is the point when the mechanism
     * is. The second travel is the one that goes through.
     *
     * It flies to z = -230, well past the ring at -150, so the camera is
     * genuinely through the aperture rather than stopping inside it.
     */
    if (sequence > 0.001) {
      const s = sample(sequence)
      /*
       * Distances are chosen against the ring at z = -150, not by feel.
       *
       * 30 leaves the whole structure in frame with room around it. -66 is
       * about eighty units off the ring, which crops it — that is the point,
       * because the unlock is detail and detail needs to be close enough to
       * read. -14 opens back out for full power, where the subject is the
       * whole object rather than its mechanism. -230 is well past the ring,
       * so the last move goes THROUGH rather than stopping inside it.
       */
      const z =
        MathUtils.lerp(REST.z, 30, s.approach) +
        (-96 * s.closeIn) +
        (52 * s.standBack) +
        (-150 * s.approachGate) +
        /*
         * Into the tunnel, not merely past the ring.
         *
         * The first version flew to -230 and the camera ended up level with
         * the structure and then out the other side into open sea — it sailed
         * PAST the portal instead of entering it. The ring plane is at -150
         * and the throat runs back from there, so the travel has to carry on
         * well beyond it for the passage to be something the viewer is inside
         * of rather than something they clipped through.
         */
        (-260 * s.through)

      /*
       * The eye line rises to the centre of the opening as it closes in.
       *
       * Held at the resting height, the tight beats looked up at the ring from
       * below the waterline and the camera could never have threaded it.
       */
      const y = MathUtils.lerp(
        REST.y,
        GATE_Y,
        Math.max(s.approach * 0.4, s.closeIn * 0.9, s.approachGate),
      )

      camera.position.set(0, y, z)
      camera.lookAt(0, GATE_Y, -520)
      return
    }

    if (under) {
      camera.position.set(0, -46, 96)
      camera.lookAt(0, -14, -120)
      return
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
