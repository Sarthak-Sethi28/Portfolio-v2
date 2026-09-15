'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Object3D,
  type InstancedMesh,
  type MeshBasicMaterial,
} from 'three'
import { cinematicClock, portalFrame } from './cinematicState'

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

function rand(i: number, salt: number): number {
  const n = Math.sin((i + 1) * (19.193 + salt * 11.71)) * 43758.5453123
  return n - Math.floor(n)
}

type LayerProps = {
  count: number
  radiusMin: number
  radiusMax: number
  lengthMin: number
  lengthMax: number
  thicknessMin: number
  thicknessMax: number
  color: string
  opacity: number
  salt: number
}

/**
 * A real 3D field of elongated light fragments behind the portal.
 *
 * These shards live in world space. The camera physically travels through them,
 * so parallax and apparent speed come from the actual camera move rather than
 * from a fullscreen starburst shader. The centre is intentionally empty: the
 * viewer always has a dark destination to fly toward.
 */
function TransitLayer({
  count,
  radiusMin,
  radiusMax,
  lengthMin,
  lengthMax,
  thicknessMin,
  thicknessMax,
  color,
  opacity,
  salt,
}: LayerProps) {
  const mesh = useRef<InstancedMesh>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      angle: rand(i, salt + 1) * Math.PI * 2,
      radius: radiusMin + rand(i, salt + 2) * (radiusMax - radiusMin),
      z: 22 + rand(i, salt + 3) * 390,
      length: lengthMin + rand(i, salt + 4) * (lengthMax - lengthMin),
      thickness: thicknessMin + rand(i, salt + 5) * (thicknessMax - thicknessMin),
      phase: rand(i, salt + 6) * Math.PI * 2,
      drift: (rand(i, salt + 7) * 2 - 1) * 0.12,
    })),
    [count, radiusMin, radiusMax, lengthMin, lengthMax, thicknessMin, thicknessMax, salt],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const g = mesh.current
    const m = mat.current
    if (!g || !m || !portalFrame.measured) return

    const t = cinematicClock.elapsed

    // It appears while the physical bore is still around the lens, then grows
    // into the dominant visual only AFTER the front ring has been crossed.
    const inAmount = span(t, 12.45, 13.12)
    const outAmount = 1 - span(t, 14.08, 14.56)
    const amount = inAmount * outAmount
    const speed = span(t, 12.72, 13.92)
    const stretch = 1 + speed * 4.8

    m.opacity = opacity * amount
    g.visible = amount > 0.002
    if (!g.visible) return

    const c = portalFrame.centre

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const a = s.angle + Math.sin(t * 0.34 + s.phase) * s.drift
      const radialBreath = 1 + Math.sin(t * 0.55 + s.phase) * 0.018 * amount
      const r = s.radius * radialBreath

      dummy.position.set(
        c.x + Math.cos(a) * r,
        c.y + Math.sin(a) * r * 0.86,
        c.z - s.z,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(
        s.thickness * (1 + speed * 0.18),
        s.thickness * (1 + speed * 0.18),
        s.length * stretch,
      )
      dummy.updateMatrix()
      g.setMatrixAt(i, dummy.matrix)
    }
    g.instanceMatrix.needsUpdate = true
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} visible={false} renderOrder={18}>
      {/* An elongated octahedron reads as a light shard rather than a laser rod. */}
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

/**
 * The red gateway after the Blender bore.
 *
 * No fullscreen overlay, no radial spokes, no second circle. Three sparse 3D
 * layers occupy the volume behind the real portal. As the camera accelerates,
 * their world-space shards stretch past the lens into deep red / scarlet / ember
 * light. Because there is no geometry close to the centre line, the middle of
 * the frame stays black and deep the whole time.
 */
export function PortalTransitVolume() {
  return (
    <>
      <TransitLayer
        count={118}
        radiusMin={13}
        radiusMax={38}
        lengthMin={4}
        lengthMax={13}
        thicknessMin={0.045}
        thicknessMax={0.13}
        color="#4a0004"
        opacity={0.24}
        salt={10}
      />
      <TransitLayer
        count={56}
        radiusMin={16}
        radiusMax={34}
        lengthMin={3}
        lengthMax={9}
        thicknessMin={0.035}
        thicknessMax={0.10}
        color="#d10a08"
        opacity={0.44}
        salt={30}
      />
      <TransitLayer
        count={22}
        radiusMin={18}
        radiusMax={30}
        lengthMin={2.5}
        lengthMax={6}
        thicknessMin={0.022}
        thicknessMax={0.065}
        color="#ff5a16"
        opacity={0.30}
        salt={60}
      />
    </>
  )
}
