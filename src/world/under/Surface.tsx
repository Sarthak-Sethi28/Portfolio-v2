'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, RepeatWrapping, Vector2, type Texture } from 'three'

/**
 * The water surface, seen from below.
 *
 * Upstairs this plane is the ground. Here it is the CEILING — and that single
 * reuse is the whole idea: you have not travelled sideways to a new place, you
 * have dropped through the mirror you were already looking at.
 *
 * Rendered BackSide since we are beneath it, and highly reflective so it reads
 * as a bright membrane with the world dark underneath. The normal map is the
 * same one the surface uses upstairs, so the ripples agree between worlds.
 */
export function Surface() {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const base = useTexture('/water-normal.jpg') as Texture

  const map = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(22, 22)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [base, maxAniso])

  const normalScale = useMemo(() => new Vector2(0.9, 0.9), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    map.offset.set(t * 0.0075, t * 0.0046)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      <meshStandardMaterial
        side={BackSide}
        color="#7f99ad"
        roughness={0.2}
        metalness={0.9}
        envMapIntensity={1.6}
        normalMap={map}
        normalScale={normalScale}
      />
    </mesh>
  )
}
