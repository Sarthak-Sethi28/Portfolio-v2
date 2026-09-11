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

const REST = new Vector3(0, 11.5, 104)
const TARGET = new Vector3(0, 15, -30)

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
    const breathX = Math.sin(t * 0.047) * 5.2 + Math.sin(t * 0.0163) * 2.1
    const breathY = Math.sin(t * 0.0331) * 1.15
    const breathZ = Math.cos(t * 0.0391) * 3.4

    // Pointer parallax, heavily damped.
    lean.current.x = MathUtils.damp(lean.current.x, pointer.x * 7.5, 1.6, delta)
    lean.current.y = MathUtils.damp(lean.current.y, pointer.y * 2.6, 1.6, delta)

    camera.position.set(
      REST.x + breathX + lean.current.x,
      REST.y + breathY + lean.current.y,
      REST.z + breathZ,
    )
    camera.lookAt(TARGET)
  })

  return null
}
