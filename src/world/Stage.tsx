'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { MathUtils, type DirectionalLight, type FogExp2 } from 'three'
import { CONFIG_DEFAULTS, useScene, effectiveMoteCount } from '@/store/scene'
import { blendPalette, createPalette } from './atmosphere/palette'
import { Sky } from './atmosphere/Sky'
import { Motes } from './atmosphere/Motes'
import { Birds } from './atmosphere/Birds'
import { Water } from './array/Water'
import { ArrayWorld } from './array/ArrayWorld'
import { IdleRig } from './camera/IdleRig'
import { createAnim, type Anim } from './anim'
import { FlickerProbe } from './FlickerProbe'

/**
 * Composes a world: atmosphere, geometry, lighting, and the grade.
 *
 * Owns the frame clock and the day/night blend. Everything below it reads a
 * palette that this component mutates in place once per frame, rather than
 * each subsystem deriving colour independently and drifting out of agreement.
 */
export function Stage() {
  const night = useScene((s) => s.night)
  const config = useScene((s) => s.config)
  const quality = useScene((s) => s.quality)
  const rain = useScene((s) => s.rain)
  const moteCount = useScene((s) => effectiveMoteCount({ config: s.config, quality: s.quality }))
  const flags = useScene((s) => s.flags)
  const setFlicker = useScene((s) => s.setFlicker)

  const palette = useMemo(() => createPalette(), [])
  // NOTE: no chromatic aberration.
  //
  // Even at sub-pixel offsets it split every drifting mote into separate red
  // and blue dots, which reads as coloured speckle crawling over the frame
  // rather than as a lens characteristic. Grain alone carries the film feel.
  const animRef = useRef<Anim>(createAnim())
  const sunRef = useRef<DirectionalLight>(null)

  const fogRef = useRef<FogExp2>(null)

  /**
   * Image-based lighting comes from <Environment> below.
   *
   * This is the difference between "a render" and "a photograph", and leaving
   * it out was the largest single reason the slabs read as flat cardboard.
   *
   * A directional light delivers light from exactly one direction, so a face
   * turned away from it receives nothing but a flat ambient constant. In the
   * real world — and in the reference frame — every surface is lit by the
   * WHOLE sky: the teal zenith rakes the tops, the warm horizon catches the
   * lower faces, and the gradient between them is what makes concrete look
   * like concrete. Feeding the same panorama that draws the sky in as the
   * scene environment gives every material that for free, and guarantees the
   * lighting agrees with the sky the viewer can actually see.
   */

  useFrame((_, delta) => {
    // Ease toward the target rather than snapping — the cross-fade IS the
    // day/night transition, so its duration is the feature.
    const anim = animRef.current
    anim.night = MathUtils.damp(anim.night, night ? 1 : 0, 1.4, delta)
    blendPalette(anim.night, palette)

    const fog = fogRef.current
    if (fog) {
      fog.color.copy(palette.fog)
      fog.density = config.fogDensity * palette.fogDensityScale
    }

    if (sunRef.current) {
      sunRef.current.position.copy(palette.sunDirection).multiplyScalar(420)
      sunRef.current.color.copy(palette.sunColor)
      sunRef.current.intensity = palette.keyIntensity
    }
  })

  return (
    <>
      {/* Declared rather than assigned onto scene: mutating a value returned
          from a hook is a React Compiler violation, and attach does it for us. */}
      <fogExp2
        ref={fogRef}
        attach="fog"
        args={[palette.fog.getHex(), CONFIG_DEFAULTS.fogDensity]}
      />

      {/* background={false}: the Sky shader already draws the visible dome,
          with the sun and the day/night blend the plate cannot provide. This
          instance exists only to light the scene. */}
      <Environment files="/sky/dusk.jpg" background={false} environmentIntensity={1.15} />

      <Sky palette={palette} anim={animRef} />

      {/* Kept, but weak. The environment map now carries the fill; the
          hemisphere only tints the very bottom faces the panorama cannot see. */}
      <hemisphereLight
        args={[palette.ambient, palette.waterTint, palette.ambientIntensity * 0.45]}
      />
      {/*
        The sun casts now. A shadow map covers a fixed volume, so the frustum
        is sized to the composition rather than to the whole world — spread
        over 1600 units every shadow would be a blurry smear, and tight to the
        piers they are crisp where anyone is looking.
      */}
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-220}
        shadow-camera-right={220}
        shadow-camera-top={220}
        shadow-camera-bottom={-220}
        shadow-camera-near={120}
        shadow-camera-far={900}
        shadow-bias={-0.0009}
        shadow-normalBias={0.6}
      />

      <Suspense fallback={null}>
        <Water
          palette={palette}
          roughness={config.waterRoughness}
          reflectorResolution={flags.noReflect ? 0 : quality.reflectorResolution}
          distort={rain ? 0.75 : 0.32}
        />
        <ArrayWorld palette={palette} />
      </Suspense>

      <Motes count={flags.noMotes ? 0 : moteCount} palette={palette} />
      {/* Something in the frame with its own intent. A drifting camera over a
          still world still reads as a photograph. */}
      {!flags.still && <Birds palette={palette} />}
      <IdleRig />

      {/* multisampling is NOT optional.
          EffectComposer renders into its own buffer, which silently discards
          the `antialias: true` set on the Canvas. Without it every edge in the
          scene is hard-aliased, and because the idle camera never stops
          drifting those edges crawl pixel by pixel — which is what reads as
          the whole image flickering. There is 120fps of headroom here. */}
      {flags.probe && <FlickerProbe onSample={setFlicker} />}

      {/* multisampling is 4x, not 8x: at DPR 2 it is billed per sub-sample
          across the whole framebuffer, and 8x was a large part of what turned
          a locked 120fps into a juddering 43-50. SMAA below covers the rest. */}
      {flags.noPost ? null : (
      <EffectComposer enableNormalPass={false} multisampling={flags.noMs ? 0 : 4}>
        {/* NO BLOOM.
            Bisected with Playwright: bloom alone takes frame-to-frame size
            variance from 1.05x to 61x, and the broken frames are the scene
            drawn into a fraction of the viewport with the rest black —
            intermittent, and a violent flicker. Its internal render targets do
            not stay in step with the canvas, and a fixed resolution does not
            help, so the effect is simply unusable here.

            Little is lost: the sun's disc, halo and wide glow are all drawn
            analytically in the sky shader, so the light still blooms. This
            only removed a pass that added a touch more on top. */}
        {flags.noSmaa ? <></> : <SMAA />}
        <Vignette offset={0.2} darkness={0.78} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {/* NO GRAIN.
            The Noise effect regenerates a fresh random field every frame. On a
            120Hz display that is not "film grain", it is the image flickering
            120 times a second — it was the flicker, not a frame-rate problem
            (measured: a locked 120fps with zero drops). Static grain would
            need to be a fixed texture sampled in screen space; a per-frame
            random is unusable regardless of opacity. */}
      </EffectComposer>
      )}
    </>
  )
}
