'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import {
  Box3,
  Color,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three'
import { useScene } from '@/store/scene'
import { sample } from '../sequence'
import { Throat } from './Throat'
import { Runway } from './Runway'

/** The four structural quadrants, in the order the ignition travels. */
const SEGMENTS = ['seg_right', 'seg_top', 'seg_left', 'seg_bottom'] as const
/** Angle each quadrant's mass sits at, radians. Used for its escape vector. */
const SEG_ANGLE = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]

/**
 * THE APERTURE — Sarthak's model, in four movable pieces.
 *
 * MEASURED, NOT ASSUMED. The asset is Y-up, sits on y=0 and spans
 * 1.90 x 1.88 x 0.72 — a ring already facing the camera. No corrective
 * rotation is applied, because adding one on the assumption that Blender
 * exports Z-up is exactly the bug that made the satellite dish render as a
 * flat slab. Scale and pivot are read from the bounding box at runtime, so a
 * re-export at another size cannot silently break the composition.
 *
 * THE SPLIT. The original export is a single welded mesh, which meant nothing
 * inside it could move — and "segments shift" is the hinge of the sequence.
 * scripts/split-portal.mjs recovers the parts by walking the index buffer:
 * there were 94 disconnected shells in there all along, four of them large
 * arcs centred at 0, 90, 180 and 270 degrees. The fittings are grouped with
 * whichever arc they sit nearest, so a bracket travels with the arc it is
 * bolted to.
 *
 * PIVOTS. Each segment keeps the model's own origin and is re-centred here by
 * nesting: an outer group at the ring's centre, the segment offset back by the
 * same amount inside it. Rotating the outer group therefore turns the piece
 * about the ring rather than about the model's feet. Baking that pivot into
 * the file would hard-code a centre that a re-export could move.
 */
export function ModelAperture({
  height = 84,
  position = [0, -10, -150] as [number, number, number],
}: {
  height?: number
  position?: [number, number, number]
}) {
  const { scene } = useGLTF('/models/portal-parts.glb')
  const nightLevel = useScene((s) => s.nightLevel)
  const seq = useScene((s) => s.sequence)
  const emissive = useTexture('/models/portal-emissive.jpg') as Texture

  /*
   * Shared by every material, written once a frame.
   *
   * A uniform object rather than a React value on purpose: changing it costs
   * nothing and touches no component, whereas driving a shader from state
   * would re-render the whole world tree sixty times a second.
   */
  const uSweep = useRef({ value: 0 }).current

  const built = useMemo(() => {
    /*
     * glTF textures are NOT flipped.
     *
     * Images through TextureLoader default to flipY = true, the convention for
     * everything except glTF. Attaching one to UVs that came out of a glb
     * without clearing the flag maps the emissive upside down against the
     * surface it is meant to light, and the glow lands on the wrong half of
     * the ring looking like a shader fault.
     */
    emissive.flipY = false
    emissive.colorSpace = SRGBColorSpace
    emissive.needsUpdate = true

    const root = scene.clone(true)
    const lit: MeshStandardMaterial[] = []

    /*
     * The ring's centre in the model's own units, measured before the
     * materials are built because the sweep shader needs it. Taken from the
     * untouched clone rather than typed in, so a re-export cannot leave the
     * ignition rotating about the wrong point.
     */
    const preBox = new Box3().setFromObject(root)
    const centreY = (preBox.min.y + preBox.max.y) / 2

    root.traverse((o) => {
      const mesh = o as unknown as Mesh
      if (!(mesh as { isMesh?: boolean }).isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      /*
       * Clone materials before touching them. Loaded assets share material
       * instances across every copy in the scene, and the mirrored world
       * renders this same component — editing in place once deleted the
       * entire city, because a clipping plane meant for the reflection was
       * applied to the originals too.
       */
      const was = mesh.material
      const list = (Array.isArray(was) ? was : [was]) as MeshStandardMaterial[]
      const next = list.map((mat) => {
        const copy = mat.clone()
        // roughness and envMapIntensity MULTIPLY the asset's maps rather than
        // replacing them, so the worn patches stay worn while the whole
        // surface shifts toward specular.
        copy.roughness = 0.62
        copy.envMapIntensity = 3.6
        copy.emissiveMap = emissive
        copy.emissive = new Color('#ffffff')
        copy.emissiveIntensity = 0

        /*
         * THE LIGHT TRAVELS — and it has to actually travel.
         *
         * The first version ramped the whole emissive up at once and called it
         * ignition. That is a fade, not a travel: board 09 is light RUNNING
         * around the ring from the point it enters, and the difference is the
         * whole beat — one says a lamp was switched on, the other says
         * something is moving through the structure.
         *
         * It cannot be done by fading segments in turn, because all four
         * quadrants share one material. So the mask is computed per FRAGMENT
         * from the model-space angle: each pixel knows where it sits around
         * the ring, and lights only once the wavefront has reached it. A
         * narrow leading edge burns brighter than the trail behind it, which
         * is what reads as a charge front rather than a wipe.
         *
         * Injected with onBeforeCompile rather than written as a custom
         * material, so everything the asset already has — its maps, the
         * lighting model, shadows — survives untouched.
         */
        copy.onBeforeCompile = (shader) => {
          shader.uniforms.uSweep = uSweep
          shader.uniforms.uCentreY = { value: centreY }
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying vec3 vLocal;\nuniform float uSweep;\nuniform float uCentreY;',
            )
            .replace(
              '#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
               // 0 at the crown, running once around the ring.
               float ang = atan(vLocal.y - uCentreY, vLocal.x);
               float turn = fract((ang - 1.5707963) / 6.2831853 + 1.0);
               // Lit behind the front, with a hot narrow leading edge.
               float lit = step(turn, uSweep);
               float edge = smoothstep(0.09, 0.0, uSweep - turn) * step(turn, uSweep);
               totalEmissiveRadiance *= lit + edge * 2.5;`,
            )
        }
        // Two materials that compile to different programs must not be
        // deduplicated into one, and three keys that cache on this string.
        copy.customProgramCacheKey = () => 'portal-sweep'
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
      mesh.material = (Array.isArray(was) ? next : next[0]) as Mesh['material']
    })

    const size = new Vector3()
    const box = new Box3().setFromObject(root)
    box.getSize(size)
    const scale = size.y > 0 ? height / size.y : 1

    // The ring's centre in the model's own units — the pivot every segment
    // turns about, and the radius the ignition travels along.
    const centre = new Vector3()
    box.getCenter(centre)

    const parts = SEGMENTS.map((name) => root.getObjectByName(name)).filter(
      Boolean,
    ) as Object3D[]

    return { root, lit, scale, parts, pivotY: centre.y, radius: size.x / 2 }
  }, [scene, emissive, height])

  const groups = useRef<(Group | null)[]>([])

  useFrame(() => {
    const s = sample(seq)

    for (let i = 0; i < built.parts.length; i++) {
      const g = groups.current[i]
      if (!g) continue
      const a = SEG_ANGLE[i]

      /*
       * Each quadrant escapes along ITS OWN radius and twists as it goes.
       *
       * Moving them all one direction would slide the ring apart; moving each
       * outward from the centre opens every seam at once while the circle
       * stays a circle, which is what makes it read as a mechanism unlocking
       * rather than as a model falling to bits. The counter-rotation is what
       * sells it as driven — stone that only translates looks dropped, stone
       * that turns looks released.
       *
       * The quadrants are staggered so they do not all let go on the same
       * frame; a mechanism that moves in perfect lockstep looks like a
       * screensaver.
       */
      const stagger = Math.max(0, Math.min(1, s.unlock * 1.45 - i * 0.15))
      const e = stagger * stagger * (3 - 2 * stagger)

      /*
       * A LOCK TURNING, not a ring coming apart.
       *
       * The first attempt pushed each quadrant straight out along its own
       * radius. From the front that reads as the ring inflating and then
       * falling to bits — the opposite of the beat, which is a mechanism
       * disengaging. The boards show the segments OFFSET AROUND the ring and
       * stepped in depth, the way tumblers in a lock move.
       *
       * So the dominant motion is rotation about the ring's own axis, in
       * alternating directions so adjacent quadrants counter-rotate against
       * each other and the thing looks driven rather than dropped. Depth does
       * the rest: each quadrant steps back a different distance, which opens
       * the seams and lets the inner mechanism show through without anything
       * having to fly away. The radial component is small — just enough to
       * break the seal — rather than the whole idea.
       */
      /*
       * SMALL. The circle has to survive.
       *
       * At 0.2 radians the quadrants no longer met their neighbours and the
       * ring visibly disintegrated — a broken object, not a mechanism. Each
       * quadrant spans ninety degrees, so anything past a couple of degrees of
       * twist opens a wedge at one end and drives an overlap at the other.
       *
       * The read comes from DEPTH instead. Every quadrant steps back a
       * different distance, so the seams between them open into shadow and the
       * inner structure shows through, while from the front the ring stays a
       * ring. A lock disengaging barely moves; it is the sound and the shift
       * of planes that tell you it has.
       */
      const dir = i % 2 ? -1 : 1
      g.rotation.z = e * 0.032 * dir
      const out = e * built.radius * 0.018
      g.position.set(
        Math.cos(a) * out,
        Math.sin(a) * out,
        -e * built.radius * (0.05 + i * 0.045),
      )
    }

    /*
     * THE LIGHT TRAVELS.
     *
     * One material is shared by all four quadrants, so the ignition cannot be
     * a per-segment fade without splitting the material too. It is driven on
     * the emissive strength instead, ramping through ignition and holding at
     * full power — and because night is the state the sequence lands in, the
     * night level keeps it lit afterwards rather than the sequence having to
     * hold its own value forever.
     */
    /*
     * The wavefront runs once around during ignition and then stays past the
     * end, so the ring holds fully lit rather than the front wrapping round
     * again forever.
     */
    uSweep.value = Math.max(s.ignition, nightLevel)

    const glow = Math.max(s.ignition * 1.2 + s.power * 1.6, nightLevel * 2.6)

    /*
     * DORMANT AT THE ARRIVAL.
     *
     * The asset's own baseColor has the red channel painted into it, so with
     * emissive at zero the ring still arrived glowing — it could never read as
     * the dead stone of board 01. `color` multiplies that texture, so a cool
     * grey knocks the red back and reads as cold unpowered metal, and lifting
     * it to white as the portal ignites returns every bit of the paintwork.
     * Dimming alone would not do it: the problem is the hue, not the level.
     */
    const woke = Math.max(s.ignition, nightLevel)
    for (const m of built.lit) {
      m.emissiveIntensity = glow
      m.color.setRGB(
        0.42 + woke * 0.58,
        0.52 + woke * 0.48,
        0.58 + woke * 0.42,
      )
    }
  })

  const lights = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(built.root).getSize(size)
    const s = size.y > 0 ? height / size.y : 1
    return { cy: (size.y / 2) * s, r: (size.x / 2) * 0.55 * s, z: (size.z / 2) * s }
  }, [built, height])

  return (
    <group position={position}>
      <group scale={built.scale}>
        {built.parts.map((part, i) => (
          // Outer group sits at the ring's centre; the segment is pushed back
          // by the same amount inside it, so rotation happens about the ring.
          <group key={part.name} position={[0, built.pivotY, 0]}>
            <group ref={(g) => { groups.current[i] = g }}>
              <group position={[0, -built.pivotY, 0]}>
                <primitive object={part} />
              </group>
            </group>
          </group>
        ))}
      </group>

      {/*
        Light on the water leading in — see Runway. It lives outside the
        portal's own group in Z so it runs from behind the camera up to the
        ring, rather than starting at the ring and going nowhere.
      */}
      <Runway opacity={sample(seq).power * 0.5} z={180} />

      {/*
        The passage the camera travels — see Throat. It is placed at the ring's
        centre and runs away from the viewer, and it does not exist at all
        until the approach starts, so nothing about the arrival gives away that
        there is anywhere to go.
      */}
      <group position={[0, lights.cy, 0]}>
        <Throat
          radius={lights.r * 0.98}
          length={height * 6}
          /*
           * Keyed to `through`, not to the approach.
           *
           * Fading it in from the moment the camera started moving meant a
           * half-transparent tunnel was visible inside the ring from fifty
           * units away, and at low alpha its ribs and rails read as a red
           * wireframe net stretched across the opening. The aperture is meant
           * to be a dark way through until you are in it. Ramped fast so it is
           * solid by the time the camera reaches the ring plane.
           */
          opacity={Math.min(1, sample(seq).through * 2.4)}
        />
      </group>

      {/*
        The channel has to LIGHT things, not just be bright. Emissive is a
        surface telling the camera it is glowing; it contributes nothing to
        anything around it, so without these the water at the portal's feet was
        entirely unaware of it — a decal laid over the shot rather than a
        source in the scene. Intensity obeys inverse square, so it is sized
        against the distance it crosses rather than picked as a 0-1 dial.
      */}
      {[Math.PI / 2, Math.PI * 1.25, Math.PI * 1.75].map((a, i) => (
        <pointLight
          key={`rl-${i}`}
          position={[Math.cos(a) * lights.r, lights.cy + Math.sin(a) * lights.r, lights.z * 0.4]}
          color="#ff3418"
          intensity={Math.max(nightLevel, sample(seq).power) * height * height * 0.11}
          distance={height * 1.15}
          decay={2}
        />
      ))}
    </group>
  )
}

useGLTF.preload('/models/portal-parts.glb')
