'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Color, Plane, Vector3, type Mesh, type MeshStandardMaterial } from 'three'
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
  mirrored = false,
  glow = 0,
}: {
  placement: Placement
  /** Which asset to use. See the note in ArrayWorld on mixing them. */
  src?: string
  /**
   * Render as a REFLECTION rather than as the object.
   *
   * The mirrored copy previously reused this component as-is, which meant it
   * shared material instances with the real world — so anything done to the
   * reflection's materials happened to the originals too. A clipping plane
   * tried that way deleted the entire city.
   *
   * With this set, the clone gets its OWN materials: darker, blue-shifted,
   * and clipped at the waterline. A reflection is an image of a thing, not a
   * second copy of it, and it has to be treated as one.
   */
  mirrored?: boolean
  /**
   * Light bleeding out through the carved stone, 0 to 1.
   *
   * Each column IS a project, so the architecture becomes the index — you
   * read the world rather than a menu laid over it. A lantern made of stone
   * also gives the arrival its only warmth, against a plain lit by a fallen
   * galaxy and a sky with nothing in it.
   */
  glow?: number
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

    // Clip whatever the mirror pushes above the waterline. Only ever applied
    // to CLONED materials, never to the shared originals — doing that once
    // deleted the entire city.
    const clip = mirrored ? [new Plane(new Vector3(0, -1, 0), 0)] : null
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

      if (mirrored) {
        const mesh = o as unknown as Mesh
        const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as
          MeshStandardMaterial[]
        mesh.material = src.map((mat) => {
          const copy = mat.clone()
          // An image in water: darker, cooler, and never casting anything.
          copy.color?.multiplyScalar(0.42)
          copy.color?.lerp(new Color('#22394f'), 0.45)
          if ('envMapIntensity' in copy) copy.envMapIntensity = 0.15
          copy.clippingPlanes = clip
          copy.needsUpdate = true
          return copy
        }) as unknown as Mesh['material']
        mesh.castShadow = false
        mesh.receiveShadow = false
        return
      }

      m.castShadow = true
      m.receiveShadow = true

      if (glow > 0) {
        const mesh = o as unknown as Mesh
        const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as
          MeshStandardMaterial[]
        mesh.material = src.map((mat) => {
          const copy = mat.clone()
          copy.emissive = new Color('#ffb877')
          // Strong. These are the only warm light in the arrival, and against
          // an emptied sky and a galaxy underfoot they have to carry the frame
          // — at 0.55 the columns disappeared entirely.
          copy.emissiveIntensity = glow * 2.6
          copy.needsUpdate = true
          return copy
        }) as unknown as Mesh['material']
      }
    })
    return c
  }, [scene, mirrored, glow])

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
            /*
             * Into the water, not onto it.
             *
             * This has swung twice: drowned to the spire tips, then lifted
             * clear so the columns perched on the surface like furniture. The
             * middle is a base that is genuinely cut by the waterline — deep
             * enough that the foot is gone, shallow enough that the carving
             * above it is all visible.
             */
            height * (variant === 1 ? 0.3 : variant === 2 ? 0.46 : 0.085),
          0,
        ]}
      />
    </group>
  )
}

useGLTF.preload('/models/pillar.glb')
useGLTF.preload('/models/muqarnas.glb')
