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

type Key<T> = [number, T]

function samplePath(keys: Key<Vector3>[], t: number, out: Vector3): Vector3 {
  if (t <= keys[0][0]) return out.copy(keys[0][1])
  const last = keys[keys.length - 1]
  if (t >= last[0]) return out.copy(last[1])
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t >= t0 && t <= t1) {
      const x = (t - t0) / (t1 - t0)
      return out.copy(v0).lerp(v1, x * x * (3 - 2 * x))
    }
  }
  return out.copy(last[1])
}

function sampleScalar(keys: Key<number>[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1]
  const last = keys[keys.length - 1]
  if (t >= last[0]) return last[1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t >= t0 && t <= t1) {
      const x = (t - t0) / (t1 - t0)
      const s = x * x * (3 - 2 * x)
      return v0 + (v1 - v0) * s
    }
  }
  return last[1]
}

/**
 * The pre-flight camera direction.
 *
 * This pass deliberately removes the late "impact kick". The portal reaching
 * red power is supposed to feel inevitable and heavy; shaking the lens at the
 * same moment as the water discharge made the beat read as a bomb. Power is
 * communicated by the water and pillars reacting, not by hitting the camera.
 */
export function CinematicCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const status = useScene((s) => s.cinematic)
  const seqFlag = useScene((s) => s.flags.seq)
  const engaged = status === 'playing' || seqFlag !== null

  /*
   * Stay predominantly frontal while the causal sequence plays:
   * water -> charge -> red surface front -> columns -> night. The slight pull
   * back around ten seconds is intentional: it keeps water and columns in the
   * composition while they respond, then the camera returns to the gateway for
   * the signed-off approach shot.
   */
  const paths = useMemo(() => {
    const c = portalFrame.centre
    const pos: Key<Vector3>[] = [
      [0.0, new Vector3(0, 9, 128)],
      [2.0, new Vector3(0, 9.5, 121)],
      [4.0, new Vector3(0, 11, 104)],
      [6.0, new Vector3(0, 12.5, 88)],
      [7.0, new Vector3(0, 14, 72)],
      [8.2, new Vector3(0, 16.5, 56)],
      [9.0, new Vector3(0, 18, 50)],
      [10.5, new Vector3(0, 19, 58)],
      [11.45, new Vector3(0, 23, 28)],
      // Matches PortalTransitionRig's measured start closely for a silent handoff.
      [11.85, new Vector3(0, 26, 16)],
    ]

    const aim: Key<Vector3>[] = [
      [0.0, new Vector3(0, 26, -110)],
      [4.0, new Vector3(0, 28, -128)],
      [6.0, c.clone()],
      [11.85, c.clone()],
    ]

    const fov: Key<number>[] = [
      [0.0, 50],
      [9.0, 50],
      [10.5, 51],
      [11.85, 48.5],
    ]

    return { pos, aim, fov }
  }, [])

  const scratch = useMemo(
    () => ({ p: new Vector3(), a: new Vector3(), look: new ProxyCamera(), q: new Quaternion() }),
    [],
  )

  /**
   * Final safety veil. Frame 15's authored black/red look is a separate shader
   * in PortalTransitionOverlay; this plane exists only to guarantee the hidden
   * destination reposition is completely covered.
   */
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

    // From 11.85 onward the dedicated rig owns every camera transform. Keep
    // only the safety veil alive here.
    if (portalTransitionActive.value) {
      mat.opacity = s.blackout
      return
    }

    // Fallback for scrubs that land under the final veil without the flight rig.
    if (s.blackout >= 0.98 || t >= 14.48) {
      camera.position.copy(HOME_POS)
      scratch.look.position.copy(HOME_POS)
      scratch.look.lookAt(HOME_TARGET)
      camera.quaternion.copy(scratch.look.quaternion)
      camera.fov = HOME_FOV
      camera.updateProjectionMatrix()
      mat.opacity = t >= DURATION ? 0 : s.blackout
      return
    }

    samplePath(paths.pos, t, scratch.p)
    samplePath(paths.aim, t, scratch.a)
    camera.position.copy(scratch.p)

    scratch.look.position.copy(scratch.p)
    scratch.look.lookAt(scratch.a)
    camera.quaternion.copy(scratch.look.quaternion)

    const fov = sampleScalar(paths.fov, t)

    // Blend out of whatever pose IdleRig had when the visitor pressed F.
    const e = entry.current
    if (e && t < 0.45) {
      const x = t / 0.45
      const k = x * x * (3 - 2 * x)
      camera.position.lerpVectors(e.pos, scratch.p, k)
      scratch.q.copy(e.quat).slerp(camera.quaternion, k)
      camera.quaternion.copy(scratch.q)
      camera.fov = e.fov + (fov - e.fov) * k
    } else {
      camera.fov = fov
    }

    camera.updateProjectionMatrix()
    mat.opacity = s.blackout
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
