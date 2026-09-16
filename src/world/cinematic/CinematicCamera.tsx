'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera as ProxyCamera,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import type { PerspectiveCamera } from 'three'
import { useScene } from '@/store/scene'
import {
  cameraOwnedByCinematic,
  cinematicClock,
  cinematicSample,
  portalFrame,
  portalTransitionActive,
} from './cinematicState'
import { DURATION } from './timeline'

const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50
const FLIGHT_HANDOFF = 10.75

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

/**
 * The first ten seconds are no longer a list of camera shots.
 *
 * A list of smoothstepped keyframes reaches zero velocity at every key, which
 * is exactly the "one thing happens, stop, next thing happens" feeling we are
 * removing. This is one analytic forward move from the opening frame into the
 * gateway handoff. The world supplies the beats; the camera never parks for one.
 */
export function CinematicCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const status = useScene((s) => s.cinematic)
  const seqFlag = useScene((s) => s.flags.seq)
  const engaged = status === 'playing' || seqFlag !== null

  const scratch = useMemo(
    () => ({ p: new Vector3(), a: new Vector3(), look: new ProxyCamera(), q: new Quaternion() }),
    [],
  )

  /** Safety black only for the hidden destination handback. */
  const veil = useMemo(() => {
    const m = new Mesh(
      new PlaneGeometry(2, 2),
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    m.frustumCulled = false
    m.renderOrder = 10000
    m.position.set(0, 0, -0.4)
    m.scale.set(3, 3, 1)
    return m
  }, [])

  useEffect(() => {
    camera.add(veil)
    scene.add(camera)
    return () => {
      camera.remove(veil)
      veil.geometry.dispose()
      ;(veil.material as MeshBasicMaterial).dispose()
    }
  }, [camera, veil, scene])

  const entry = useRef<{ pos: Vector3; quat: Quaternion; fov: number } | null>(null)
  useEffect(() => {
    if (status === 'playing' && seqFlag === null) {
      entry.current = {
        pos: camera.position.clone(),
        quat: camera.quaternion.clone(),
        fov: camera.fov,
      }
    } else if (status !== 'playing') {
      entry.current = null
    }
  }, [status, seqFlag, camera])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    cameraOwnedByCinematic.value = engaged
    const mat = veil.material as MeshBasicMaterial

    if (!engaged) {
      mat.opacity = 0
      return
    }

    const t = cinematicClock.elapsed
    const s = cinematicSample

    // Once the dedicated flight owns the camera, this component only keeps the
    // safety veil synchronized.
    if (portalTransitionActive.value) {
      mat.opacity = s.blackout
      return
    }

    if (s.blackout >= 0.98 || t >= 14.46) {
      camera.position.copy(HOME_POS)
      scratch.look.position.copy(HOME_POS)
      scratch.look.lookAt(HOME_TARGET)
      camera.quaternion.copy(scratch.look.quaternion)
      camera.fov = HOME_FOV
      camera.updateProjectionMatrix()
      mat.opacity = t >= DURATION ? 0 : s.blackout
      return
    }

    const u = Math.max(0, Math.min(1, t / FLIGHT_HANDOFF))

    // Always forward. The linear term guarantees non-zero motion at every point;
    // the power term gradually adds urgency without introducing another beat.
    const forward = 0.36 * u + 0.64 * Math.pow(u, 1.72)
    scratch.p.set(
      0,
      9 + 17 * (0.58 * u + 0.42 * u * u),
      128 - 90 * forward,
    )

    // The eye also turns toward the gateway continuously rather than snapping
    // from the water to the ring at a timestamp.
    const aimBlend = smooth01(Math.min(1, u * 1.08))
    const c = portalFrame.centre
    const aimX = portalFrame.measured ? c.x : 0
    const aimY = portalFrame.measured ? c.y : 32
    const aimZ = portalFrame.measured ? c.z : -134
    scratch.a.set(
      aimX * aimBlend,
      26 + (aimY - 26) * aimBlend,
      -110 + (aimZ + 110) * aimBlend,
    )

    camera.position.copy(scratch.p)
    scratch.look.position.copy(scratch.p)
    scratch.look.lookAt(scratch.a)
    camera.quaternion.copy(scratch.look.quaternion)

    const targetFov = 50 - 1.5 * Math.pow(u, 1.45)

    // Blend out of the exact live pose in the first fraction of a second, but
    // that blend itself feeds directly into the same continuous path.
    const e = entry.current
    if (e && t < 0.45) {
      const k = smooth01(t / 0.45)
      camera.position.lerpVectors(e.pos, scratch.p, k)
      scratch.q.copy(e.quat).slerp(camera.quaternion, k)
      camera.quaternion.copy(scratch.q)
      camera.fov = e.fov + (targetFov - e.fov) * k
    } else {
      camera.fov = targetFov
    }

    camera.updateProjectionMatrix()
    mat.opacity = s.blackout
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
