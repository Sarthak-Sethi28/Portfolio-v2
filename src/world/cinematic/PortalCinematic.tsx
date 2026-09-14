'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  Vector3,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
} from 'three'
import { cinematicSample, portalFrame } from './cinematicState'

/**
 * THE PORTAL — Blender's animation, driven by our clock.
 *
 * The machine's motion is baked. R3F does not transform a single shell piece:
 * everything the structure does — the unlock wave, the counter-rotating
 * layers, the pressure pulse — is in the clip, and reproducing any of it here
 * would mean two authorities on the same geometry that drift apart the moment
 * either is edited.
 *
 * SYNCHRONISATION. The mixer is never allowed to run free. `action.play()`
 * followed by `mixer.update(delta)` integrates the animation forward, so its
 * position becomes a function of how many frames have been drawn and how long
 * each took — at 120Hz it lands somewhere different from 60Hz, and a single
 * dropped frame puts it permanently behind. Instead the mixer is told
 * absolutely where to be, every frame, from the master clock. At t = 6.4 the
 * portal is in exactly one pose, on any machine, at any frame rate, after any
 * hitch.
 */
export function PortalCinematic({
  height = 84,
  position = [0, -10, -150] as [number, number, number],
}: {
  height?: number
  position?: [number, number, number]
}) {
  const { scene, animations } = useGLTF('/models/portal-cinematic.glb')

  const built = useMemo(() => {
    const root = scene.clone(true)

    /*
     * The energy sections, ordered by where they actually are.
     *
     * Sorted by angular position around the portal's centre rather than by
     * name. The export order of EMIT_00..11 happens to follow the circle here,
     * but relying on that would make the ignition's direction a property of a
     * filename — and it would silently scramble the moment the asset is
     * rebuilt with a different section count. Measured from geometry, the
     * circuit travels the ring because the ring is what it is reading.
     *
     * Zero is the bottom of the ring, and the circuit runs from there.
     */
    const centre = new Box3().setFromObject(root).getCenter(new Vector3())
    const emits: { obj: Object3D; mat: MeshStandardMaterial; turn: number }[] = []
    const indicators: { mat: MeshStandardMaterial; order: number }[] = []

    root.traverse((o) => {
      const mesh = o as unknown as Mesh
      if (!(mesh as { isMesh?: boolean }).isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      /*
       * THE DORMANT SHELL IS NOT RENDERED, and this is a contract decision
       * rather than a taste one.
       *
       * docs/endpoints/day-home.png is immutable and it shows the MACHINE:
       * the dark ring with its red channel and gold fittings. The shell was
       * specified in step 2 to hide exactly that, and the two requirements
       * cannot both hold — a shell whose entire job is to conceal the machine
       * cannot also be a frame that displays it. Rendering it put a flat stone
       * donut on the day homepage in place of the signed-off portal.
       *
       * The geometry and its animation stay in the asset, so nothing is lost
       * and turning it back on is one line. But the endpoint wins: it is the
       * rule the brief called immutable, and it is the state the visitor
       * actually arrives in.
       *
       * The consequence is honest and worth stating: the unlock beat currently
       * has nothing to open. The machine's own quadrants are the right thing
       * to separate, and they already exist split in portal-parts.glb.
       */
      if (o.name.startsWith('SHELL_SEG_')) {
        o.visible = false
        return
      }

      const isEmit = o.name.startsWith('EMIT_')
      const isInd = o.name.startsWith('IND_')
      if (!isEmit && !isInd) return

      /*
       * Clone the material per section, once, at load.
       *
       * The arcs are separate objects but Blender may hand back shared
       * material instances, and setting emissiveIntensity on a shared material
       * lights every section at once — the circuit would become a single fade,
       * which is the exact effect this is built to avoid. Cloned here rather
       * than per frame: cloning a material allocates and forces a shader
       * recompile, and doing that sixty times a second is a stall, not an
       * animation.
       */
      const src = mesh.material as MeshStandardMaterial
      const mat = src.clone()
      mat.emissiveIntensity = 0
      mesh.material = mat

      const p = new Vector3()
      o.getWorldPosition(p)
      if (isEmit) {
        // Angle measured from straight down, running one way round.
        const a = Math.atan2(p.y - centre.y, p.x - centre.x)
        const turn = ((a + Math.PI / 2) / (Math.PI * 2) + 1) % 1
        emits.push({ obj: o, mat, turn })
      } else {
        indicators.push({ mat, order: 0 })
      }
    })

    emits.sort((a, b) => a.turn - b.turn)
    indicators.forEach((ind, i) => (ind.order = i / Math.max(1, indicators.length - 1)))

    const size = new Box3().setFromObject(root).getSize(new Vector3())
    const scale = size.y > 0 ? height / size.y : 1

    return { root, emits, indicators, scale, centre, radius: (size.x / 2) * scale }
  }, [scene, height])

  const mixer = useMemo(() => new AnimationMixer(built.root), [built.root])

  useEffect(() => {
    const clip = animations.find((c) => c.name === 'Cinematic') ?? animations[0]
    if (!clip) return
    const action = mixer.clipAction(clip)
    action.setLoop(LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    /*
     * NOT paused, and this is the whole bug.
     *
     * Pausing looked like the right way to stop the clip free-running while
     * the mixer's time is set explicitly. It is not: AnimationMixer.setTime
     * works by resetting to zero and calling update(), and
     * AnimationAction.update() returns immediately when the action is paused.
     * So the seek arrived and was discarded, every frame — the portal held
     * frame zero for the entire fifteen seconds while everything else in the
     * world moved around it.
     *
     * It was invisible for a long time because the parts of the portal that
     * DID respond — the travelling circuit, the indicators, the red spill —
     * are all driven from R3F rather than from the clip, so the machine looked
     * alive while none of its geometry had moved at all.
     *
     * setTime alone is sufficient: it rewinds and re-evaluates from zero on
     * every call, so the action can never accumulate its own progress.
     */
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(built.root)
    }
  }, [mixer, animations, built.root])

  /*
   * The spill lights are held by ref and written in the frame loop.
   *
   * Reading a ref during render to compute `intensity` is a React Compiler
   * violation and, more importantly, a lie: the value would be whatever it was
   * at the last React render rather than at this frame, so the red would lag
   * the circuit by however long it happened to be between renders. Setting
   * `.intensity` directly in the loop is both legal and correct.
   */
  const spillLights = useRef<(PointLight | null)[]>([])

  /*
   * eslint-disable-next-line is deliberate, and narrow.
   *
   * Everything below mutates three.js objects — mixer time, material emissive,
   * light intensity — inside a frame callback. That is the entire contract of
   * an imperative renderer driven from React, and the compiler cannot model
   * it: it sees values that came out of a useMemo being written to and assumes
   * a render-phase mutation. The alternative is rebuilding the scene graph
   * through state sixty times a second, which is the thing R3F exists to avoid.
   */
  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const s = cinematicSample

    /*
     * Absolute, not incremental.
     *
     * setTime seeks; update(delta) integrates. Only the first is reproducible.
     */
    mixer.setTime(s.portalTime)

    /*
     * THE TRAVELLING CIRCUIT.
     *
     * Each section lights when the wavefront reaches its own angular position,
     * with a short rise rather than a step, so the light runs round the ring
     * instead of the ring fading up. The leading section burns brighter than
     * the trail behind it — a charge front, not a wipe.
     *
     * The geometry itself becomes luminous. Nothing here depends on Bloom,
     * which was removed from this project after it was measured taking
     * frame-to-frame variance from 1.05x to 61x.
     */
    for (const e of built.emits) {
      const local = (s.ignition - e.turn * 0.92) / 0.1
      const lit = Math.min(1, Math.max(0, local))
      const front = Math.max(0, 1 - Math.abs(local - 1) * 1.6)
      /*
       * Restrained, because the colour is the point.
       *
       * At 2.2 rising to 4.2 on the leading edge the channel clipped straight
       * through its own red and came out white — the asset's emission is
       * (1.0, 0.16, 0.07) but any channel driven far enough past 1 arrives at
       * the top of all three after tone mapping. The circuit has to stay red
       * while it travels, so the front is a smaller lift over a dimmer trail
       * rather than a brighter one over a bright one.
       */
      e.mat.emissiveIntensity = lit * (1.15 + s.power * 0.85) + front * 0.9
    }

    /*
     * Indicators come AFTER the circuit, and stay far below it.
     *
     * They are two percent of the object. Lighting them with the channel would
     * make the machine read as a switchboard; arriving once the power is up
     * makes them read as systems confirming.
     */
    for (const ind of built.indicators) {
      const on = Math.min(1, Math.max(0, (s.power - 0.15 - ind.order * 0.35) * 3.2))
      ind.mat.emissiveIntensity = on * 0.9
    }

    // The spill follows the circuit as it completes, then holds at power.
    const level = Math.max(s.ignition * 0.75, s.power)
    for (const l of spillLights.current) {
      if (l) l.intensity = level * height * height * 0.16
    }
  })
  /* eslint-enable react-hooks/immutability */

  /*
   * Publish the portal's real frame for the camera.
   *
   * Done in an effect rather than during render because it writes to a shared
   * module, and measured from the built root so it follows the asset rather
   * than a constant that has to be kept in step by hand.
   */
  useEffect(() => {
    portalFrame.centre.set(position[0], position[1] + height / 2, position[2])
    portalFrame.axis.set(0, 0, 1)
    portalFrame.radius = built.radius
    portalFrame.measured = true
  }, [position, height, built.radius])

  return (
    <group position={position}>
      <primitive object={built.root} scale={built.scale} />

      {/*
        RED SPILL — three lights, not twelve.
        
        Emissive geometry tells the camera a surface is bright and contributes
        nothing to anything around it, so without this the water at the
        portal's feet stayed completely unaware of a machine blazing above it.
        
        Three, because one light per energy section would be twelve shader
        permutations recompiled into every material in the scene for a result
        the eye cannot separate anyway — at this distance the ring reads as one
        source. None of them cast shadows: the shadow they would cast is
        already described by the portal's own directional shadow, and twelve
        shadow maps was the single most expensive thing available to get wrong
        here.
        
        `distance` keeps the red LOCAL. Tinting the whole ocean would say the
        world turned red; a pool of light around the portal says the portal is
        lit and the sea near it is catching some.
      */}
      {[Math.PI * 0.5, Math.PI * 1.25, Math.PI * 1.75].map((a, i) => (
        <pointLight
          key={`spill-${i}`}
          position={[
            Math.cos(a) * built.radius * 0.55,
            height * 0.5 + Math.sin(a) * built.radius * 0.55,
            0,
          ]}
          color="#ff3418"
          // Inverse square over tens of units, so this is sized against the
          // distance it crosses rather than picked as a 0-1 dial.
          ref={(l) => {
            spillLights.current[i] = l
          }}
          intensity={0}
          distance={height * 1.5}
          decay={2}
          castShadow={false}
        />
      ))}
    </group>
  )
}

useGLTF.preload('/models/portal-cinematic.glb')
