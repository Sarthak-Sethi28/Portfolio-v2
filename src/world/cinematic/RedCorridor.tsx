'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { cinematicClock, portalFrame } from './cinematicState'

/** Where the corridor lives in world Z, relative to the aperture. */
const NEAR_END = -60
const FAR_END = -240
/*
 * TWO passes instead of per-instance colour.
 *
 * Instance colours were the obvious way to vary these and they could not be
 * made to render: setColorAt creates the attribute lazily, after the material
 * has compiled without the instancing-colour define, and forcing a recompile
 * did not recover it either. Rather than keep fighting a path that produced a
 * fully built, correctly positioned, completely invisible corridor, the wall
 * and the hot filaments are simply two meshes with flat materials — which
 * demonstrably render. Two draw calls instead of one is not a cost worth
 * arguing about.
 */
const WALL_SHARDS = 340
const EMBER_SHARDS = 90

/** Deterministic, so a scrub renders the same corridor every time. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * THE TRANSIT CORRIDOR — real geometry, in world space.
 *
 * This replaces a fullscreen quad parented to the camera with depthTest off.
 * That approach can never work for what this shot needs: a screen-space plane
 * has no depth, so nothing on it can move relative to anything else, and the
 * camera cannot travel THROUGH something that is always exactly the same
 * distance from the lens. It was, precisely, screen graphics.
 *
 * So the corridor is built out of five hundred thin shards standing in a tube
 * beyond the bore, at radii and depths drawn once from a seeded generator.
 * The camera flies down the middle of them. Everything the viewer reads as
 * speed — shards stretching past the edges of frame, near ones tearing by
 * while far ones drift, the sense of a throat opening ahead — is real
 * parallax from real positions, which is the one thing no overlay can fake.
 *
 * THE CENTRE IS EMPTY. Nothing is placed inside the inner radius, so the view
 * straight ahead stays black all the way through. A corridor you cannot see
 * the end of is what makes it feel deep; put anything in the middle and it
 * becomes a tunnel with a wall.
 *
 * Colour is held to one family — oxblood through crimson to a few scarlet
 * embers — with brightness falling off with radius, so the walls are dim and
 * only the occasional filament is hot.
 *
 * One InstancedMesh: five hundred shards, one draw call, no per-frame
 * allocation. The transforms are computed once at mount.
 */
export function RedCorridor() {
  const ref = useRef<InstancedMesh>(null)

  const built = useMemo(() => {
    const r = rng(0x51d3a7)
    const geometry = new BoxGeometry(1, 1, 1)

    const make = (color: number, opacity: number) =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })

    // Dim oxblood for the body of the tube; scarlet for the few hot filaments.
    const wallMat = make(0x6e0f07, 0)
    const emberMat = make(0xff2a12, 0)

    /*
     * AN ENCLOSING SHELL, so this is somewhere rather than something.
     *
     * Without it the moon and the open sea were plainly visible between the
     * shards, and the corridor read as an effect drawn over the world instead
     * of a place the camera had entered. A dark tube seen from the inside
     * occludes the world the moment the lens is inside it, which is what makes
     * the transit feel like a transit — and it gives the shards something
     * black to be bright against.
     *
     * Open-ended on purpose: the far end must stay a vanishing point, not a
     * wall the camera can see itself approaching.
     */
    const shellGeo = new CylinderGeometry(78, 78, Math.abs(FAR_END - NEAR_END) + 160, 40, 1, true)
    shellGeo.rotateX(Math.PI / 2)
    const shellMat = new MeshBasicMaterial({
      color: 0x0a0204,
      side: BackSide,
      /*
       * OPAQUE, deliberately.
       *
       * As a transparent surface it sat in the transparent queue with
       * depthWrite off, and the moon and open sea still read straight through
       * it — the corridor looked like streaks drawn over the world. An opaque
       * shell writes depth and simply occludes, which is the only reliable way
       * to put the camera somewhere else.
       *
       * Visibility is switched rather than faded for the same reason: a
       * partially transparent shell is exactly the failure being fixed.
       */
      toneMapped: false,
    })

    const m = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const scl = new Vector3()
    const axis = new Vector3(0, 0, 1)

    const build = (count: number, longer: number) => {
      const out: Matrix4[] = []
      for (let i = 0; i < count; i++) {
        const angle = r() * Math.PI * 2
        /*
         * Radius biased outward, so most of the material hugs the wall of the
         * tube and almost none comes near the axis. That is what keeps the
         * centre of frame black while the periphery is dense — a corridor you
         * cannot see the end of is what makes it feel deep.
         */
        const radius = 13 + Math.pow(r(), 0.55) * 47
        const z = NEAR_END + (FAR_END - NEAR_END) * r()
        pos.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z)

        /*
         * Long in Z and thin across it. A shard elongated along the direction
         * of travel reads as a streak the instant the camera moves — the
         * geometry IS the motion blur, with none of its cost.
         */
        const len = (12 + r() * 70) * longer
        scl.set(0.22 + r() * 1.0, 0.22 + r() * 1.0, len)
        q.setFromAxisAngle(axis, r() * Math.PI)
        out.push(m.clone().compose(pos, q, scl))
      }
      return out
    }

    /*
     * THE VANISHING POINT.
     *
     * The tube alone was not enough: its far opening is wide, and the open sea
     * was plainly visible through it — the camera was inside a pipe with a
     * view of the world at the end. Capping it turns that opening into the
     * deep black centre the shot is supposed to be travelling toward, and a
     * corridor whose end you cannot see through is the whole reason it reads
     * as depth rather than as a pipe.
     */
    const capGeo = new CircleGeometry(80, 40)
    const capMat = new MeshBasicMaterial({ color: 0x000000, toneMapped: false })

    return {
      geometry,
      wallMat,
      emberMat,
      shellGeo,
      shellMat,
      capGeo,
      capMat,
      wall: build(WALL_SHARDS, 1),
      embers: build(EMBER_SHARDS, 1.5),
    }
  }, [])

  const emberRef = useRef<InstancedMesh>(null)
  const shellRef = useRef<import('three').Mesh>(null)
  const capRef = useRef<import('three').Mesh>(null)

  useEffect(() => {
    const pairs: [InstancedMesh | null, Matrix4[]][] = [
      [ref.current, built.wall],
      [emberRef.current, built.embers],
    ]
    for (const [mesh, mats] of pairs) {
      if (!mesh) continue
      for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i])
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
    }
  }, [built])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = cinematicClock.elapsed

    /*
     * Present only for the crossing, and faded by TIME rather than by the
     * camera's position, so a scrub lands on exactly the right density.
     *
     * It comes up as the lens reaches the mouth of the bore and is gone by the
     * handback, which is when the screen is black anyway.
     */
    const rise = Math.max(0, Math.min(1, (t - 12.55) / 0.85))
    const fall = Math.max(0, Math.min(1, (t - 14.25) / 0.45))
    const amount = rise * (1 - fall)

    const c = portalFrame.centre
    const ember = emberRef.current
    mesh.position.set(c.x, c.y, c.z)
    if (ember) ember.position.set(c.x, c.y, c.z)

    /*
     * It closes around the lens only once the machinery is behind us.
     *
     * Switched on early it would black out the bore itself, and the shot needs
     * the portal's own interior to pass before the world disappears —
     * darkness should arrive because the machine went by, not because a lid
     * came down.
     */
    if (shellRef.current) {
      shellRef.current.position.set(c.x, c.y, c.z + (NEAR_END + FAR_END) / 2)
      shellRef.current.visible = amount > 0.42
    }
    if (capRef.current) {
      // Always well ahead of the lens, so it is never arrived at.
      capRef.current.position.set(c.x, c.y, c.z + FAR_END - 30)
      capRef.current.visible = amount > 0.42
    }

    built.wallMat.opacity = amount * 0.6
    built.emberMat.opacity = amount
    mesh.visible = amount > 0.004
    if (ember) ember.visible = amount > 0.004
  })
  /* eslint-enable react-hooks/immutability */

  /*
   * Positioned in the FRAME LOOP, not in JSX.
   *
   * portalFrame is published by the portal in an effect, which runs after this
   * component's first render — so reading it here to set a prop anchored the
   * whole corridor to the fallback centre and never corrected, because this
   * component has no reason to render again. Anything derived from a shared
   * mutable value has to be read where that value is current.
   */
  return (
    <>
      <mesh ref={shellRef} geometry={built.shellGeo} material={built.shellMat} visible={false} renderOrder={-1} />
      <mesh ref={capRef} geometry={built.capGeo} material={built.capMat} visible={false} renderOrder={-1} />
      <instancedMesh ref={ref} args={[built.geometry, built.wallMat, WALL_SHARDS]} visible={false} />
      <instancedMesh ref={emberRef} args={[built.geometry, built.emberMat, EMBER_SHARDS]} visible={false} />
    </>
  )
}
