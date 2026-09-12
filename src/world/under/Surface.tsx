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
    <>
      {/*
        Lit from BELOW.
        
        The surface is rendered BackSide, so its normals point down into the
        water — a light above it does nothing at all. Lighting it from
        underneath is what makes the wave normals catch, which is the whole
        reason the ripple map exists. It reads as light coming THROUGH the
        membrane because the ripples break it up, not because the light is
        actually up there.
      */}
      {/*
        Placed away from the architecture.
        
        At [0,-90,-40] this sat almost inside the arch and blew it to white —
        a point light falls off with the square of distance, so anything near
        it is overexposed long before the far surface is lit at all. Pushed
        down and back, it lights the ceiling across a wide area and leaves the
        stone to the cold key.
      */}
      <pointLight
        position={[0, -150, 140]}
        intensity={260000}
        distance={1400}
        decay={2}
        color="#9ccbe0"
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {/*
        The membrane emits its own light.
        
        It was relying on the environment map, and cutting that to almost
        nothing underwater — correct for the stone — took the ceiling down
        with it, leaving a uniformly black frame. But the whole read of this
        place is CONTRAST: a bright surface overhead and dark stone hanging
        beneath it. So the surface carries its own emission and stops
        depending on a light that is not down here.
      */}
      <meshStandardMaterial
        side={BackSide}
        color="#4d6c80"
        emissive="#8fb6cc"
        // Low. Emissive ignores surface normals, so at 0.85 it washed out
        // every ripple and the ceiling read as flat empty sky. It provides a
        // floor of brightness; the light below provides the TEXTURE.
        emissiveIntensity={0.22}
        roughness={0.18}
        metalness={0.7}
        envMapIntensity={0.4}
        normalMap={map}
        normalScale={normalScale}
      />
      </mesh>
    </>
  )
}
