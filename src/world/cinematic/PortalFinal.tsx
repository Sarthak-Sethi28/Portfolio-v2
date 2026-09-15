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
 * The GLB remains the source of truth for geometry. React only drives the
 * things glTF cannot carry for us: material emission and the speed/state of the
 * exported mechanical clips.
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

    let energy = null as MeshStandardMaterial | null
    const rails: MeshStandardMaterial[] = []
    const indicators: MeshStandardMaterial[] = []
    const seen = new Set<MeshStandardMaterial>()

    root.traverse((o) => {
      const mesh = o as unknown as Mesh
      if (!(mesh as { isMesh?: boolean }).isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      const src = mesh.material as MeshStandardMaterial
      if (!src) return
      const name = src.name

      if (!seen.has(src)) {
        seen.add(src)
        const copy = src.clone()
        if (name === 'PORTAL_AUTO_EnergyRed') {
          copy.emissive = new Color('#ff160a')
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
       * The long internal rails are only physical fragments in the real bore.
       * The previous pass let them carry too much of the red transition, which
       * made the camera feel as if it had entered a cheap neon pipe. The real
       * high-speed red field now lives BEHIND the Blender bore in world space,
       * so these rails can stay almost dark and simply flash past the lens.
       */
      if (o.name.startsWith('PORTAL_AUTO_TunnelRail') && name === 'PORTAL_AUTO_EnergyRed') {
        const deep = (src.userData.clone as MeshStandardMaterial).clone()
        deep.emissive = new Color('#7d0804')
        deep.emissiveIntensity = 0
        mesh.material = deep
        rails.push(deep)
      }
    })

    const box = new Box3().setFromObject(root)
    const size = new Vector3()
    box.getSize(size)
    const scale = size.y > 0 ? height / size.y : 1

    const apertureLocal = new Vector3(0, (box.min.y + box.max.y) / 2, box.max.z)
    const depth = (box.max.z - box.min.z) * scale

    return { root, energy, rails, indicators, scale, apertureLocal, depth }
  }, [scene, height])

  useEffect(() => {
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
  useFrame(() => {
    const s = cinematicSample

    const alive = Math.max(s.ignition, s.power, s.night)
    for (const [name, action] of Object.entries(actions)) {
      if (!action || !name.startsWith('PORTAL_AUTO_MechanicalRing')) continue
      action.paused = alive < 0.01
      action.timeScale = 0.18 + alive * 0.42
    }

    const lit = Math.max(s.ignition * 0.9, s.power, s.night * 0.96)
    if (built.energy) built.energy.emissiveIntensity = lit * 1.45
    for (const r of built.rails) r.emissiveIntensity = lit * 0.075

    const ind = Math.max(0, Math.min(1, (s.power - 0.18) * 2.5))
    for (const g of built.indicators) g.emissiveIntensity = ind * 0.55
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={group} position={position}>
      <primitive object={built.root} scale={built.scale} />
    </group>
  )
}

useGLTF.preload('/models/portal_final.glb')
