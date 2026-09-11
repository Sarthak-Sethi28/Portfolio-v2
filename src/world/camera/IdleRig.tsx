'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'

/**
 * Luxury/cinematic idle motion should be almost subconscious. The previous rig
 * translated more than ten world units side-to-side before pointer parallax,
 * which made every hard edge sweep through many pixel phases continuously.
 * That both looked game-like and exaggerated temporal shimmer.
 *
 * This pass keeps the camera body nearly planted and moves most pointer intent
 * into the gaze target. The result is closer to a tripod/dolly head than a
 * floating noclip camera.
 */
const REST = new Vector3(0, 4.6, 58)
const TARGET = new Vector3(0, 26, -76)

export function IdleRig() {
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const freelook = useScene((s) => s.freelook)
  const still = useScene((s) => s.flags.still)

  const position = useRef(REST.clone())
  const target = useRef(TARGET.clone())

  useFrame(({ clock }, delta) => {
    if (freelook) return

    if (reducedMotion || still) {
      camera.position.copy(REST)
      camera.lookAt(TARGET)
      position.current.copy(REST)
      target.current.copy(TARGET)
      return
    }

    const t = clock.elapsedTime

    // Low-frequency dolly breath. Total displacement is intentionally tiny
    // relative to the old 10+ unit orbit.
    const desiredX = REST.x + Math.sin(t * 0.052) * 1.55 + Math.sin(t * 0.017) * 0.42
    const desiredY = REST.y + Math.sin(t * 0.039) * 0.28
    const desiredZ = REST.z + Math.cos(t * 0.046) * 0.9

    position.current.x = MathUtils.damp(position.current.x, desiredX, 2.4, delta)
    position.current.y = MathUtils.damp(position.current.y, desiredY, 2.4, delta)
    position.current.z = MathUtils.damp(position.current.z, desiredZ, 2.4, delta)

    // Pointer interaction rotates the composition by changing the point of
    // interest instead of translating the whole camera through space.
    const desiredTargetX = TARGET.x + pointer.x * 5.2
    const desiredTargetY = TARGET.y + pointer.y * 2.1
    target.current.x = MathUtils.damp(target.current.x, desiredTargetX, 2.2, delta)
    target.current.y = MathUtils.damp(target.current.y, desiredTargetY, 2.2, delta)
    target.current.z = MathUtils.damp(target.current.z, TARGET.z, 2.2, delta)

    camera.position.copy(position.current)
    camera.lookAt(target.current)
  })

  return null
}
