'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

/**
 * The radio telescope, as a real mesh.
 *
 * The lathed version was the least convincing object in the world — a pale
 * ellipse standing beside photogrammetried stone, and the gap read instantly.
 * It matters more than scenery because this dish is the contact form (spec
 * 5a): the visitor writes into the water and it transmits. It has to be the
 * best object here, not the worst.
 */
export function DishModel({
  position,
  height = 46,
  rotation = 0,
}: {
  position: [number, number, number]
  /** Target height in world units; the asset is normalised to it. */
  height?: number
  rotation?: number
}) {
  const { scene } = useGLTF('/models/dish.glb')

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      const m = o as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean }
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return c
  }, [scene])

  const scale = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(cloned).getSize(size)
    return size.y > 0 ? height / size.y : 1
  }, [cloned, height])

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/*
        Stood upright.

        The asset is authored Z-up, which is the convention in most modelling
        tools, while three.js is Y-up — so it arrives lying flat on the water
        looking collapsed. A quarter turn about X puts it on its feet. Worth
        checking on every downloaded asset: it is the single most common
        surprise in a glTF from the wild.
      */}
      {/*
        NO axis correction.
        
        A quarter turn about X was added on the assumption the asset was
        authored Z-up, which is the usual convention. This one is not — its
        exporter already corrected the axes, so the extra rotation was laying
        an upright dish flat on the water. Measuring before assuming would
        have caught it: the root node's transform says which.
      */}
      <primitive object={cloned} scale={scale} />
    </group>
  )
}

useGLTF.preload('/models/dish.glb')
