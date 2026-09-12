'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type { Placement } from '../geometry/layout'

/**
 * A pier from a downloaded model, on trial.
 *
 * Scaled by measuring the loaded mesh rather than guessing: an asset arrives
 * in whatever units its author used — metres, centimetres, or a scanner's
 * arbitrary scale — so the only reliable way to fit one into a world is to
 * read its bounding box and normalise against the height we actually want.
 */
export function ModelPier({
  placement,
  variant = 0,
  src = '/models/pillar.glb',
}: {
  placement: Placement
  /** Which asset to use. See the note in ArrayWorld on mixing them. */
  src?: string
  /**
   * Which part of the asset to show.
   *
   * Kitbashing: one mesh used many ways. 0 is the whole tower; 1 crops to the
   * spire alone, riding higher so only the top shows above the water, and 2
   * crops to the base, a stump with its head long gone. Games do this
   * constantly — a level with four unique meshes reads as a hundred, because
   * scale, rotation and how much of a thing you can see change it more than
   * its geometry does.
   */
  variant?: number
}) {
  const { scene } = useGLTF(src)
  const { position, rotationY, tilt, height, submerge } = placement

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    /*
     * Strip the scan's display plinth.
     *
     * This asset was photogrammetried in a museum and the slab it was standing
     * on came with it — visible as a dark angled box under the pier. The
     * author left it on its own material, helpfully named "bottom", so it can
     * be removed precisely rather than hidden by sinking the whole model.
     */
    c.traverse((o) => {
      const m = o as {
        isMesh?: boolean
        visible?: boolean
        castShadow?: boolean
        receiveShadow?: boolean
        material?: { name?: string }
      }
      if (!m.isMesh) return
      if (m.material?.name?.toLowerCase().includes('bottom')) {
        m.visible = false
        return
      }
      m.castShadow = true
      m.receiveShadow = true
    })
    return c
  }, [scene])

  // Measure, then fit: read the real bounding box and normalise to the height
  // this placement asks for.
  const scale = useMemo(() => {
    const box = new Box3().setFromObject(cloned)
    const size = new Vector3()
    box.getSize(size)
    return size.y > 0 ? height / size.y : 1
  }, [cloned, height])

  return (
    <group position={position} rotation={[0, rotationY, tilt]}>
      {/*
        Sunk further than a procedural pier needs to be.

        Hiding the scan's display plinth by material name did not catch it —
        the slab is welded into the same material as the stonework, so there is
        no mesh to switch off. Dropping the model by a fixed extra fraction of
        its height puts the plinth under the surface instead, which works
        regardless of how the author organised the file.
      */}
      <primitive
        object={cloned}
        scale={scale * (variant === 1 ? 1.5 : variant === 2 ? 1.25 : 1)}
        position={[
          0,
          -height / 2 +
            submerge -
            height * (variant === 1 ? 0.42 : variant === 2 ? 0.62 : 0.02),
          0,
        ]}
      />
    </group>
  )
}

useGLTF.preload('/models/pillar.glb')
useGLTF.preload('/models/muqarnas.glb')
