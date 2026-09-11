'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'

/**
 * Resting camera behaviour.
 *
 * Two motions layered: a very slow orbital breath that never stops, and a
 * pointer parallax that leans the camera a few degrees toward the cursor. The
 * breath is what stops the opening shot feeling like a screenshot; the
 * parallax is what makes it feel like a place you are standing in.
 *
 * Disabled entirely under reduced motion — the framing stays, the movement goes.
 */

/**
 * Low, close, looking up.
 *
 * Standing height in the middle of the array reads as a diorama. Dropping the
 * lens to roughly a metre above the water and aiming it up past the near
 * monoliths is the whole trick: the foreground slabs run off the top of the
 * frame, and anything that leaves the frame reads as too big to contain.
 */
const REST = new Vector3(0, 4.6, 58)
const TARGET = new Vector3(0, 26, -76)

export function IdleRig() {
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const freelook = useScene((s) => s.freelook)

  const lean = useRef(new Vector3())

  useFrame(({ clock }, delta) => {
    if (freelook) return

    if (reducedMotion) {
      camera.position.copy(REST)
      camera.lookAt(TARGET)
      return
    }

    const t = clock.elapsedTime

    // Orbital breath. Long periods, small amplitudes, deliberately irrational
    // ratios so the loop never visibly repeats.
    const breathX = Math.sin(t * 0.047) * 3.1 + Math.sin(t * 0.0163) * 1.3
    const breathY = Math.sin(t * 0.0331) * 0.5
    const breathZ = Math.cos(t * 0.0391) * 2.2

    // Pointer parallax, heavily damped.
    lean.current.x = MathUtils.damp(lean.current.x, pointer.x * 5.5, 1.6, delta)
    lean.current.y = MathUtils.damp(lean.current.y, pointer.y * 1.4, 1.6, delta)

    camera.position.set(
      REST.x + breathX + lean.current.x,
      REST.y + breathY + lean.current.y,
      REST.z + breathZ,
    )
    camera.lookAt(TARGET)
  })

  return null
}
