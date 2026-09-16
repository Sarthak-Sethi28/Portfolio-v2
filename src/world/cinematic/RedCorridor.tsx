'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { blenderTunnelActive, cinematicClock, portalFrame } from './cinematicState'

const NEAR_END = -72
const FAR_END = -250
const DARK_FILAMENTS = 34
const HOT_FILAMENTS = 10

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * FRAME 14 -> FRAME 15.
 *
 * Storyboard lock:
 * - Until the camera is almost through the real Blender bore, NOTHING abstract
 *   competes with it. Frame 14 must be metal, depth, red reflections and a
 *   black centre.
 * - Only after the machinery has rushed past do a few red after-images remain
 *   in actual 3D space. Frame 15 is mostly black with sparse red lines at the
 *   edges, not a dense hyperspace tube.
 *
 * The previous corridor used hundreds of shards and arrived too early. Even
 * with real parallax, the density itself read as a generated effect. This
 * version is intentionally sparse: a few long filaments, a dark shell and a
 * black vanishing point.
 */
export function RedCorridor() {
  const darkRef = useRef<InstancedMesh>(null)
  const hotRef = useRef<InstancedMesh>(null)
  const shellRef = useRef<import('three').Mesh>(null)
  const capRef = useRef<import('three').Mesh>(null)

  const built = useMemo(() => {
    const rand = rng(0x8a11c0de)

    // Thin physical filaments, elongated in Z. Cylinder rather than boxes so
    // they do not read as rectangular UI bars when they pass close to camera.
    const geometry = new CylinderGeometry(0.11, 0.11, 1, 5, 1, true)
    geometry.rotateX(Math.PI / 2)

    const darkMat = new MeshBasicMaterial({
      color: 0x7a1008,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const hotMat = new MeshBasicMaterial({
      color: 0xff2a12,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })

    const m = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const scale = new Vector3()
    const axis = new Vector3(0, 0, 1)

    const build = (count: number, hot: boolean) => {
      const out: Matrix4[] = []
      for (let i = 0; i < count; i++) {
        // Keep a large empty centre. Most streaks live near frame edges.
        const angle = rand() * Math.PI * 2
        const radius = (hot ? 27 : 31) + Math.pow(rand(), 0.45) * (hot ? 25 : 31)
        const z = NEAR_END + (FAR_END - NEAR_END) * rand()

        // More material on left/right than top/bottom, matching the reference
        // transition rather than a symmetric starburst.
        const sideBias = 0.82 + Math.abs(Math.cos(angle)) * 0.32
        pos.set(
          Math.cos(angle) * radius * sideBias,
          Math.sin(angle) * radius * (0.72 + rand() * 0.24),
          z,
        )

        const length = (hot ? 24 : 18) + rand() * (hot ? 75 : 55)
        const width = (hot ? 0.7 : 0.48) + rand() * (hot ? 0.75 : 0.55)
        scale.set(width, width, length)
        q.setFromAxisAngle(axis, (rand() - 0.5) * 0.10)

        out.push(m.clone().compose(pos, q, scale))
      }
      return out
    }

    const shellGeo = new CylinderGeometry(72, 72, Math.abs(FAR_END - NEAR_END) + 150, 36, 1, true)
    shellGeo.rotateX(Math.PI / 2)
    const shellMat = new MeshBasicMaterial({
      color: 0x030002,
      side: BackSide,
      toneMapped: false,
    })

    const capGeo = new CircleGeometry(74, 36)
    const capMat = new MeshBasicMaterial({
      color: 0x000000,
      toneMapped: false,
    })

    return {
      geometry,
      darkMat,
      hotMat,
      shellGeo,
      shellMat,
      capGeo,
      capMat,
      dark: build(DARK_FILAMENTS, false),
      hot: build(HOT_FILAMENTS, true),
    }
  }, [])

  useEffect(() => {
    const sets: [InstancedMesh | null, Matrix4[]][] = [
      [darkRef.current, built.dark],
      [hotRef.current, built.hot],
    ]

    for (const [mesh, matrices] of sets) {
      if (!mesh) continue
      for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
    }
  }, [built])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const dark = darkRef.current
    const hot = hotRef.current
    if (!dark || !hot) return

    const t = cinematicClock.elapsed
    const c = portalFrame.centre

    /*
     * Crucial timing:
     * 13.0-13.75 = REAL BLENDER BORE ONLY.
     * 13.75 onward = machinery has passed; sparse red remnants can appear.
     *
     * This keeps the 13.4 storyboard frame purely physical.
     */
    const inAmount = span(t, 13.72, 13.96)
    const outAmount = 1 - span(t, 14.24, 14.58)
    /*
     * Suppressed entirely while the Blender render is on screen.
     *
     * Multiplied to zero rather than early-returned so every uniform, opacity
     * and visibility flag below still runs and settles at its off state — an
     * early return would leave whatever values happened to be set on the last
     * frame before the handoff, and they would reappear when the clip ends.
     */
    const amount = inAmount * outAmount * (blenderTunnelActive.value ? 0 : 1)

    dark.position.set(c.x, c.y, c.z)
    hot.position.set(c.x, c.y, c.z)

    built.darkMat.opacity = amount * 0.28
    built.hotMat.opacity = amount * 0.78

    dark.visible = amount > 0.004
    hot.visible = amount > 0.004

    // World disappears only after the camera has physically left the authored
    // bore. No black tube can cover Frame 14.
    const enclosed = t >= 13.82 && t < 14.56
    if (shellRef.current) {
      shellRef.current.position.set(c.x, c.y, c.z + (NEAR_END + FAR_END) / 2)
      shellRef.current.visible = enclosed
    }
    if (capRef.current) {
      capRef.current.position.set(c.x, c.y, c.z + FAR_END - 34)
      capRef.current.visible = enclosed
    }
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <mesh
        ref={shellRef}
        geometry={built.shellGeo}
        material={built.shellMat}
        visible={false}
        renderOrder={-1}
      />
      <mesh
        ref={capRef}
        geometry={built.capGeo}
        material={built.capMat}
        visible={false}
        renderOrder={-1}
      />
      <instancedMesh
        ref={darkRef}
        args={[built.geometry, built.darkMat, DARK_FILAMENTS]}
        visible={false}
      />
      <instancedMesh
        ref={hotRef}
        args={[built.geometry, built.hotMat, HOT_FILAMENTS]}
        visible={false}
      />
    </>
  )
}
