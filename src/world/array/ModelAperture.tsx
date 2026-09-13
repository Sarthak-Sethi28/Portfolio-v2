'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import {
  Box3,
  Color,
  SRGBColorSpace,
  Vector3,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import { useScene } from '@/store/scene'

/**
 * THE APERTURE — Sarthak's model.
 *
 * This replaces the procedural ring. Worth being honest about why: the built
 * one was chasing a concept through code, and every pass fixed a real defect
 * while still landing somewhere short — a washer, then a gear, then masonry
 * that was finally correct and still not the thing in the boards. An authored
 * mesh carries what procedural geometry in this project could not: chipped
 * arrises, erosion that follows the form, and baked maps that already contain
 * the contact shadow this renderer has no ambient occlusion to supply.
 *
 * MEASURED, NOT ASSUMED. The asset is Y-up, sits on y=0, and spans 1.90 x 1.88
 * x 0.72 — a ring standing in the XY plane with its opening along Z, which is
 * to say already facing the camera. No corrective rotation is applied, because
 * adding one on the assumption that Blender exports Z-up is precisely the bug
 * that made the satellite dish render as a flat slab for half a day. The scale
 * comes from reading its bounding box at runtime rather than from a constant,
 * so re-exporting at any size cannot break the composition.
 *
 * The emissive map ships BESIDE the glb rather than inside it, so it is loaded
 * separately and attached here — which turns out to be the better arrangement,
 * because its strength is then ours to animate: dark stone by day, lit from
 * within at night, one asset serving both states of the sequence.
 */
export function ModelAperture({
  /**
   * Height in world units, base to crown.
   *
   * Matched to the day ring on the main instance: 84 units, which puts the
   * portal's diameter at about the height of the tall column beside it. That
   * ratio is the one the eye actually reads, because the columns are the only
   * familiar object in frame and everything else is measured against them.
   *
   * It was 124 — carried over from the procedural ring's diameter — and the
   * gate crowded the shot, reading as pressed against the camera rather than
   * standing across the water from it.
   *
   * The base sits ten units under the surface so the bottom arc is cut by the
   * water, as it is on the day build. A ring resting exactly on the waterline
   * looks placed there; one the water runs through looks like it was here
   * first.
   */
  height = 84,
  position = [0, -10, -150] as [number, number, number],
}: {
  height?: number
  position?: [number, number, number]
}) {
  const { scene } = useGLTF('/models/portal.glb')
  const nightLevel = useScene((s) => s.nightLevel)

  const emissive = useTexture('/models/portal-emissive.jpg') as Texture

  const { cloned, lit } = useMemo(() => {
    /*
     * glTF textures are NOT flipped.
     *
     * Images loaded through TextureLoader default to flipY = true, which is
     * the convention for everything except glTF. Attaching one to a mesh whose
     * UVs came out of a glb without clearing that flag maps the emissive
     * upside down against the surface it is meant to light — the glow lands on
     * the wrong half of the ring and looks like a shader fault.
     */
    emissive.flipY = false
    emissive.colorSpace = SRGBColorSpace
    emissive.needsUpdate = true

    const c = scene.clone(true)
    const lit: MeshStandardMaterial[] = []

    c.traverse((o) => {
      const mesh = o as unknown as Mesh
      if (!(mesh as { isMesh?: boolean }).isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      /*
       * Clone the materials before touching them.
       *
       * The mirrored copy of the world reuses this same component, and
       * materials arrive shared between every instance of a loaded asset —
       * editing them in place once deleted the entire city, because a clipping
       * plane meant for the reflection was applied to the originals too.
       */
      const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as
        MeshStandardMaterial[]
      const next = src.map((mat) => {
        const copy = mat.clone()
        /*
         * More polish on the metal.
         *
         * `roughness` and `envMapIntensity` MULTIPLY the asset's own maps
         * rather than replacing them, so this keeps every bit of variation the
         * texture author put in — the worn patches stay worn — while shifting
         * the whole surface toward specular. Dropping roughness is what makes
         * the gold fittings catch a highlight and read as metal instead of as
         * painted trim.
         *
         * The environment is dimmed to about a fifth at night so stone does
         * not glow like a sunset, and a metal surface has nothing BUT the
         * environment, so it has to be bought back here or the reflection it
         * is supposed to show simply is not there.
         */
        copy.roughness = 0.62
        copy.envMapIntensity = 3.6
        copy.emissiveMap = emissive
        copy.emissive = new Color('#ffffff')
        copy.emissiveIntensity = 0
        copy.needsUpdate = true
        lit.push(copy)
        return copy
      })
      /*
       * Preserve array-ness. Wrapping a single material in an array and
       * assigning it back renders NOTHING: three draws array materials by
       * walking geometry.groups, and a glTF primitive has none, so the mesh
       * silently produces zero draw calls.
       */
      mesh.material = (Array.isArray(mesh.material) ? next : next[0]) as Mesh['material']
    })

    return { cloned: c, lit }
  }, [scene, emissive])

  // Read the real bounding box and normalise to the height we want.
  const scale = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(cloned).getSize(size)
    return size.y > 0 ? height / size.y : 1
  }, [cloned, height])

  const glow = useRef(0)
  useFrame(() => {
    // Animated on the materials rather than baked in the memo: night level
    // moves in small steps, and keying the clone on it would rebuild the whole
    // asset dozens of times across a single transition.
    glow.current = nightLevel
    for (const m of lit) m.emissiveIntensity = glow.current * 2.6
  })

  /*
   * Where the ring's own light lives, derived from the measured box.
   *
   * The centre of the opening is half the model's height up from its base, and
   * the channel sits at roughly 0.55 of its half-width. Both are read off the
   * bounding box rather than typed in, so a re-export at a different size
   * cannot silently leave the lights floating outside the ring.
   */
  const lights = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(cloned).getSize(size)
    const s = size.y > 0 ? height / size.y : 1
    return { cy: (size.y / 2) * s, r: (size.x / 2) * 0.55 * s, z: (size.z / 2) * s }
  }, [cloned, height])

  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} />

      {/*
        The channel has to LIGHT things, not just be bright.

        Emissive is a surface telling the camera it is glowing; it contributes
        nothing to anything around it. Left alone, a portal with a blazing red
        core sat in a world where the water at its feet and the stone beside it
        were completely unaware of it — which reads as a decal laid over the
        shot rather than as a source in the scene. Three lights are enough to
        wrap the opening and reach the surface below.

        Intensity obeys inverse square here, so this is sized against the
        distance it crosses rather than picked as a 0-1 dial.
      */}
      {[Math.PI / 2, Math.PI * 1.25, Math.PI * 1.75].map((a, i) => (
        <pointLight
          key={`rl-${i}`}
          position={[
            Math.cos(a) * lights.r,
            lights.cy + Math.sin(a) * lights.r,
            lights.z * 0.4,
          ]}
          color="#ff3418"
          intensity={nightLevel * height * height * 0.11}
          distance={height * 1.15}
          decay={2}
        />
      ))}
    </group>
  )
}

useGLTF.preload('/models/portal.glb')
