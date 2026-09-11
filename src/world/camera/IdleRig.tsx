'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'

const REST = new Vector3(0, 4.6, 58)
const TARGET = new Vector3(0, 26, -76)

/**
 * Cinematic resting camera.
 *
 * The previous rig translated the camera by more than ten world units and then
 * added another large pointer-driven translation. In a scene made of long,
 * high-contrast verticals that creates constant edge travel and a floating,
 * game-camera feel. Premium interactive work usually gets its sense of life
 * from tiny positional drift plus a damped change in gaze.
 */
export function IdleRig() {
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const freelook = useScene((s) => s.freelook)
  const still = useScene((s) => s.flags.still)

  const gaze = useRef(new Vector3())
  const lookTarget = useRef(TARGET.clone())

  useFrame(({ clock }, delta) => {
    if (freelook) return

    if (reducedMotion || still) {
      camera.position.copy(REST)
      camera.lookAt(TARGET)
      return
    }

    const t = clock.elapsedTime

    // Slow sub-meter-to-few-meter breathing instead of a wide orbit.
    const breathX = Math.sin(t * 0.052) * 1.8 + Math.sin(t * 0.0187) * 0.65
    const breathY = Math.sin(t * 0.036) * 0.42
    const breathZ = Math.cos(t * 0.045) * 1.25

    camera.position.set(
      REST.x + breathX,
      REST.y + breathY,
      REST.z + breathZ,
    )

    // Pointer interaction changes where the lens LOOKS, not where the viewer's
    // whole body teleports. The damping also removes micro-jitter from pointer
    // sampling without making the scene feel dead.
    gaze.current.x = MathUtils.damp(gaze.current.x, pointer.x * 3.2, 2.4, delta)
    gaze.current.y = MathUtils.damp(gaze.current.y, pointer.y * 1.65, 2.4, delta)

    lookTarget.current.set(
      TARGET.x + gaze.current.x,
      TARGET.y + gaze.current.y,
      TARGET.z,
    )
    camera.lookAt(lookTarget.current)
  })

  return null
}
