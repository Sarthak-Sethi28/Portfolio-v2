'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import {
  Box3,
  Color,
  LoopRepeat,
  Vector3,
  type Mesh,
  type MeshStandardMaterial,
} from 'three'
import { cinematicSample, portalFrame } from './cinematicState'

/**
 * THE PORTAL — the finished Blender asset, used as-is.
 *
 * This GLB is the source of truth. Nothing here rebuilds any part of it from
 * primitives, and nothing flattens its depth: the bore is 1.89 model units
 * deep against a 1.9 wide ring, and the camera physically travels down it in
 * frames 13-15. An earlier asset was only 0.72 deep, which is why the
 * traversal never read — the camera crossed a thin ring and there was nothing
 * inside to pass.
 *
 * MEASURED, NOT ASSUMED. Scale comes from the bounding box at runtime, and the
 * aperture plane and forward axis are published for the camera rig, so a
 * re-export at another size cannot leave the flight aimed at empty water.
 *
 * The red is driven here rather than baked. Blender's emissive animation does
 * not survive glTF — the format carries translation, rotation, scale and morph
 * weights and nothing else — so `PORTAL_AUTO_EnergyRed` is found by name and
 * its emissive strength comes off the cinematic timeline.
 */
export function PortalFinal({
  height = 84,
  position = [0, -10, -150] as [number, number, number],
}: {
  height?: number
  position?: [number, number, number]
}) {
  const { scene, animations } = useGLTF('/models/portal_final.glb')
  const group = useRef<import('three').Group>(null)
  const { actions } = useAnimations(animations, group)

  const built = useMemo(() => {
    const root = scene.clone(true)

    /** The one emissive channel, plus the deeper rails that echo it. */
    let energy = null as MeshStandardMaterial | null
    const rails: MeshStandardMaterial[] = []
    const indicators: MeshStandardMaterial[] = []
    const seen = new Set<MeshStandardMaterial>()

    root.traverse((o) => {
      const mesh = o as unknown as Mesh
      if (!(mesh as { isMesh?: boolean }).isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      /*
       * Materials are shared across the many meshes that use them, so each is
       * cloned exactly ONCE and the clone reused. Cloning per mesh would give
       * fifty-eight copies of the same channel to keep in step; not cloning at
       * all would mutate the cached asset and leak into the mirrored world.
       */
      const src = mesh.material as MeshStandardMaterial
      if (!src) return
      const name = src.name

      if (!seen.has(src)) {
        seen.add(src)
        const copy = src.clone()
        if (name === 'PORTAL_AUTO_EnergyRed') {
          copy.emissive = new Color('#ff1a0d')
          copy.emissiveIntensity = 0
          energy = copy
        } else if (name === 'PORTAL_AUTO_IndicatorGreen') {
          copy.emissive = new Color('#3cff88')
          copy.emissiveIntensity = 0
          indicators.push(copy)
        }
        src.userData.clone = copy
      }
      mesh.material = src.userData.clone as MeshStandardMaterial

      /*
       * The deep rails read at a fraction of the front channel.
       *
       * Inside the bore they run the full length of the tunnel and sit much
       * closer to the lens than the ring does, so matching the channel's
       * strength would make the interior a pink neon pipe. The brief's split —
       * roughly 85% graphite, 10% gold, 5% red — only survives if the thing
       * you are inside of is darker than the thing you came through.
       */
      if (o.name.startsWith('PORTAL_AUTO_TunnelRail') && name === 'PORTAL_AUTO_EnergyRed') {
        const deep = (src.userData.clone as MeshStandardMaterial).clone()
        deep.emissive = new Color('#ff1a0d')
        deep.emissiveIntensity = 0
        mesh.material = deep
        rails.push(deep)
      }
    })

    const box = new Box3().setFromObject(root)
    const size = new Vector3()
    box.getSize(size)
    const scale = size.y > 0 ? height / size.y : 1

    /*
     * The APERTURE plane, not the bounding-box centre.
     *
     * With a deep bore the box centre sits a long way behind the opening, and
     * a camera aimed at it would be pointed at the back wall rather than
     * through the hole. The front face is the maximum Z of the box; the ring's
     * centre height is the box's mid-Y.
     */
    const apertureLocal = new Vector3(0, (box.min.y + box.max.y) / 2, box.max.z)
    const depth = (box.max.z - box.min.z) * scale

    return { root, energy, rails, indicators, scale, apertureLocal, depth }
  }, [scene, height])

  useEffect(() => {
    /*
     * Publish the real frame for the camera rig.
     *
     * Everything the flight needs — where the hole is, which way is out, how
     * far back the tunnel runs — comes from the asset's own bounds rather than
     * from constants copied off a screenshot.
     */
    portalFrame.centre.set(
      position[0] + built.apertureLocal.x * built.scale,
      position[1] + built.apertureLocal.y * built.scale,
      position[2] + built.apertureLocal.z * built.scale,
    )
    portalFrame.axis.set(0, 0, 1)
    portalFrame.radius = (built.depth / 1.89) * 0.947
    portalFrame.depth = built.depth
    portalFrame.measured = true
  }, [position, built])

  useEffect(() => {
    /*
     * Both mechanical clips, together and looping.
     *
     * Their names carry Blender's export suffix, so they are matched by prefix
     * rather than typed out — a re-export bumps ".005" to ".006" and an exact
     * string would silently stop finding them.
     */
    const started: import('three').AnimationAction[] = []
    for (const [name, action] of Object.entries(actions)) {
      if (!action || !name.startsWith('PORTAL_AUTO_MechanicalRing')) continue
      action.setLoop(LoopRepeat, Infinity)
      action.play()
      action.paused = true
      started.push(action)
    }
    return () => {
      for (const a of started) a.stop()
    }
  }, [actions])

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const s = cinematicSample
    // Activation: the rings only turn once the machine is coming alive, and
    // keep turning slowly afterwards — by frame 12 activation is complete and
    // the portal is simply running.
    const alive = Math.max(s.ignition, s.power, s.night)
    for (const [name, action] of Object.entries(actions)) {
      if (!action || !name.startsWith('PORTAL_AUTO_MechanicalRing')) continue
      action.paused = alive < 0.01
      action.timeScale = 0.25 + alive * 0.55
    }
    void delta

    /*
     * RESTRAINED. Red is a recessed channel, not a coat of paint.
     *
     * Under ACES any channel driven far past 1 tops out on all three and
     * arrives white, so a bright setting does not read as more powerful — it
     * reads as less red. Power is carried by the spill onto the world and by
     * how dark everything around it is.
     */
    const lit = Math.max(s.ignition * 0.9, s.power, s.night * 0.95)
    if (built.energy) built.energy.emissiveIntensity = lit * 1.15
    // Deep rails at roughly a quarter of the front channel — see the note above.
    for (const r of built.rails) r.emissiveIntensity = lit * 0.3
    // Indicators arrive after the main power and stay far below it.
    const ind = Math.max(0, Math.min(1, (s.power - 0.2) * 2.4))
    for (const g of built.indicators) g.emissiveIntensity = ind * 0.7
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={group} position={position}>
      <primitive object={built.root} scale={built.scale} />
    </group>
  )
}

useGLTF.preload('/models/portal_final.glb')
