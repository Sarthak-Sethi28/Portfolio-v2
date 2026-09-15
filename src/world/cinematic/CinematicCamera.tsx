'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh, MeshBasicMaterial, PerspectiveCamera as ProxyCamera, PlaneGeometry, Quaternion, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useScene } from '@/store/scene'
import { cameraOwnedByCinematic, cinematicClock, cinematicSample, portalFrame, portalTransitionActive } from './cinematicState'
import { DURATION } from './timeline'

/** The stable pose both endpoints share, and the pose the cinematic returns to. */
const HOME_POS = new Vector3(0, 9, 128)
const HOME_TARGET = new Vector3(0, 26, -110)
const HOME_FOV = 50

/** A control point on a path: a time, and the value at that time. */
type Key<T> = [number, T]

/**
 * Piecewise, monotonic, overshoot-free.
 *
 * Deliberately NOT one long Catmull-Rom through every point. A spline fitted
 * to the whole path overshoots between control points, and the one place this
 * camera cannot overshoot is the aperture — a few units past the ring at speed
 * puts the lens inside a mechanical layer. Smoothstepping each segment
 * independently can never leave the interval its two endpoints define, so the
 * path is guaranteed to stay where it was authored.
 */
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
      return v0 + (v1 - v0) * (x * x * (3 - 2 * x))
    }
  }
  return last[1]
}

/**
 * One decaying pressure impulse, as a pure function of time.
 *
 * Not shake. A single damped oscillation that is over in about a fifth of a
 * second, so the frame reacts to an event and then is still again. Continuous
 * handheld noise was specifically what made every hard edge in this scene
 * cross sub-pixel boundaries forever, which is where the shimmer came from —
 * and being a closed-form function of absolute time, this cannot drift with
 * frame rate or leave a residue behind it.
 */
function impulse(t: number, at: number, amount: number): number {
  const d = t - at
  if (d < 0 || d > 0.5) return 0
  return Math.sin(d * 46) * Math.exp(-d * 13) * amount
}

export function CinematicCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const status = useScene((s) => s.cinematic)
  const seqFlag = useScene((s) => s.flags.seq)

  const engaged = status === 'playing' || seqFlag !== null

  /*
   * THE SHOT LIST, as control points.
   *
   * Aim is authored as its own path rather than being locked to the portal for
   * fifteen seconds: a camera that stares at one point the whole time reads as
   * a spline demo. Early it holds the existing composition, then migrates to
   * the ring, and on the final approach it moves THROUGH the portal so the
   * viewer feels pulled past it rather than stopping at its face.
   */
  const paths = useMemo(() => {
    const c = portalFrame.centre
    const pos: Key<Vector3>[] = [
      // 0-2  calm observation. Four percent of the way in; barely perceptible.
      [0.0, new Vector3(0, 9, 128)],
      [2.0, new Vector3(0, 9.5, 121)],
      // 2-4  disturbance. The birds and the water are the subject, not this.
      [4.0, new Vector3(0, 11, 104)],
      // 4-5.2 pillars descend. Wide enough to actually see them go.
      [5.2, new Vector3(0, 12, 93)],
      // 5.2-6 held breath. Almost stops.
      [6.0, new Vector3(0, 12.2, 91)],
      // 6-8 unlock. Closer, with a little lateral travel so the machine reads
      // as a solid with depth rather than a disc.
      [6.6, new Vector3(-4.5, 14, 72)],
      [7.4, new Vector3(3.5, 16.5, 54)],
      [8.0, new Vector3(1.5, 18, 44)],
      // 8-9.2 the circuit. Hero framing, whole ring in shot, barely moving.
      [9.2, new Vector3(0.5, 19.5, 38)],
      // 9.2-10.2 shockwave. Eases back a touch to keep water in the foreground.
      [10.2, new Vector3(0, 20.5, 44)],
      // 10.2-12 night hero.
      [12.0, new Vector3(0, 26, 14)],
      // 12-13 the pull begins.
      [13.0, new Vector3(0, 30, -38)],
      // 13-14.05 through. The ring plane is at c.z, and the path carries well
      // past it — stopping at the surface is the one thing this cannot do.
      [13.5, new Vector3(0, c.y, c.z + 45)],
      [14.05, new Vector3(0, c.y, c.z - 30)],
      [14.4, new Vector3(0, c.y, c.z - 120)],
    ]
    const aim: Key<Vector3>[] = [
      [0.0, new Vector3(0, 26, -110)],
      [4.0, new Vector3(0, 28, -128)],
      [6.0, c.clone()],
      [12.0, c.clone()],
      [13.0, new Vector3(c.x, c.y, c.z - 90)],
      [14.05, new Vector3(c.x, c.y, c.z - 400)],
      [14.4, new Vector3(c.x, c.y, c.z - 400)],
    ]
    const fov: Key<number>[] = [
      [0.0, 50], [10.2, 50], [12.0, 47.5], [13.0, 48.5],
      // Widens into the acceleration so speed reads. Stops short of fisheye.
      [14.05, 58], [14.4, 60],
    ]
    return { pos, aim, fov }
  }, [])

  // Scratch, reused every frame. Allocating vectors in a frame loop is sixty
  // garbage objects a second for values discarded immediately.
  const scratch = useMemo(
    /*
     * The look-at proxy MUST be a camera, not a plain Object3D.
     *
     * Object3D.lookAt orients differently depending on what the object is: a
     * camera or a light is turned so its -Z faces the target, everything else
     * so its +Z does. A bare Object3D proxy therefore produced a quaternion
     * rotated a half turn, and the camera spent the whole sequence pointed at
     * open ocean behind the portal — the shot list was correct and every frame
     * was aimed backwards.
     */
    () => ({ p: new Vector3(), a: new Vector3(), look: new ProxyCamera(), q: new Quaternion() }),
    [],
  )

  /*
   * THE BLACKOUT VEIL.
   *
   * A plane parented to the camera rather than a DOM overlay or a post pass:
   * it needs to be driven from the frame loop without a React render, it must
   * sit in front of everything including the portal the camera is inside of,
   * and it must not go anywhere near the post-processing stack — Bloom was
   * removed from this project after it was measured taking frame-to-frame
   * variance from 1.05x to 61x.
   */
  const veil = useMemo(() => {
    const m = new Mesh(
      new PlaneGeometry(2, 2),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }),
    )
    m.frustumCulled = false
    m.renderOrder = 10000
    m.position.set(0, 0, -0.4)
    // Sized past the frustum at that distance for any sane FOV.
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

  /*
   * A LIVE START MUST NOT SNAP.
   *
   * The pointer may have nudged IdleRig's aim before F was pressed, so the
   * real pose at that instant is not necessarily the canonical one. It is
   * captured here and blended out over the first fraction of a second.
   *
   * Deliberately NOT done when scrubbing: a screenshot at ?seq=0.72 has to
   * produce the same frame every time, and a start pose that depends on where
   * the mouse happened to be is the opposite of reproducible.
   */
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

    /*
     * From 11.9 the flight rig owns the camera outright.
     *
     * This rig's path ended by teleporting to the destination under a black
     * veil, which is exactly what the new bore makes unnecessary: there is
     * real geometry to travel through now, so the journey is no longer
     * something to hide. It still runs the veil for the final darkness.
     */
    if (portalTransitionActive.value) {
      mat.opacity = s.blackout
      return
    }

    /*
     * THE HIDDEN REPOSITION.
     *
     * Having physically flown through the ring, the camera is behind the
     * portal and cannot get back to the signed-off front composition by any
     * move the viewer should watch. So it does not: once the veil is
     * effectively opaque the camera is simply placed at the destination.
     *
     * The condition is PURE TIME, not a callback or a timer, so scrubbing to
     * 14.6 seconds shows the destination exactly as playback does — and the
     * teleport can never land a frame early on a slow machine, because it is
     * not waiting for anything to have happened.
     */
    if (s.blackout >= 0.98 || t >= 14.42) {
      camera.position.copy(HOME_POS)
      scratch.look.position.copy(HOME_POS)
      scratch.look.lookAt(HOME_TARGET)
      camera.quaternion.copy(scratch.look.quaternion)
      camera.fov = HOME_FOV
      camera.updateProjectionMatrix()
      // Clears over the last 350ms, revealing the world that was always there.
      mat.opacity = t >= DURATION ? 0 : Math.max(0, Math.min(1, (14.95 - t) / 0.42))
      return
    }

    samplePath(paths.pos, t, scratch.p)
    samplePath(paths.aim, t, scratch.a)

    /*
     * Two impulses, at the unlock and at full power. Sub-unit, and gone in a
     * fifth of a second — the camera reacts and is then still again.
     */
    const kick = impulse(t, 6.2, 0.5) + impulse(t, 9.3, 0.75)
    scratch.p.y += kick
    scratch.p.x += kick * 0.35

    camera.position.copy(scratch.p)

    // Orientation via a look-at proxy, then quaternion. Interpolating Euler
    // angles through a move that swings this far produces gimbal wobble.
    scratch.look.position.copy(scratch.p)
    scratch.look.lookAt(scratch.a)
    camera.quaternion.copy(scratch.look.quaternion)

    const fov = sampleScalar(paths.fov, t)

    // Blend out of the pose the camera actually had when F was pressed.
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
