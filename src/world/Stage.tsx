'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { MathUtils, type DirectionalLight, type FogExp2 } from 'three'
import { CONFIG_DEFAULTS, useScene, effectiveMoteCount } from '@/store/scene'
import { blendPalette, createPalette } from './atmosphere/palette'
import { Sky } from './atmosphere/Sky'
import { Motes } from './atmosphere/Motes'
import { Birds } from './atmosphere/Birds'
import { Water } from './array/Water'
import { ArrayWorld } from './array/ArrayWorld'
import { UnderWorld } from './under/UnderWorld'
import { Mirror } from './array/Mirror'
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
  const envIntensity = useScene((s) => s.envIntensity)
  // Mirrors anim.night into render scope. Written by the frame loop below.
  const nightLevel = useScene((s) => s.nightLevel)
  const setNightLevel = useScene((s) => s.setNightLevel)
  const setEnvIntensity = useScene((s) => s.setEnvIntensity)
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
    // Moonlight is a fraction of dusk, not a dimmer version of it. Written to
    // the store only when it has moved enough to see, so a smooth blend does
    // not cost a render every frame.
    const nextEnv = 1.15 - anim.night * 0.95
    if (Math.abs(nextEnv - envIntensity) > 0.02) setEnvIntensity(nextEnv)
    if (Math.abs(anim.night - nightLevel) > 0.02) setNightLevel(anim.night)

    const fog = fogRef.current
    if (fog) {
      fog.color.copy(palette.fog)
      if (flags.under) fog.color.set('#0a1d2b')
      fog.density = config.fogDensity * palette.fogDensityScale
    }

    if (sunRef.current) {
      sunRef.current.position.copy(palette.sunDirection).multiplyScalar(420)
      sunRef.current.color.copy(palette.sunColor)
      // The sun does not reach down here. Leaving it on put warm highlights
      // on submerged stone, which is the one thing water cannot do.
      sunRef.current.intensity = flags.under ? 0 : palette.keyIntensity
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
      {/*
        The environment must dim with the sky.
        
        It is a photograph of a dusk sky, and nothing was modulating it — so at
        night every surface was still being lit by a sunset that is no longer
        there. The stars would come out while the stone stayed warm, which is
        the single loudest thing wrong with a naive night mode.
        
        Driven from the same blend as everything else, so holding the
        transition mid-way gives a consistent dusk rather than a half-lit
        contradiction.
      */}
      <Environment
        files="/sky/dusk.jpg"
        background={false}
        // Underwater the sky's contribution is almost nothing. Leaving the
        // dusk environment at full strength was lighting submerged stone
        // sunset-orange, which is the single most wrong thing about the first
        // pass: water absorbs red within the first few metres, so nothing down
        // there can be warm.
        environmentIntensity={flags.under ? envIntensity * 0.06 : envIntensity}
      />

      <Sky palette={palette} anim={animRef} />

      {/* Kept, but weak. The environment map now carries the fill; the
          hemisphere only tints the very bottom faces the panorama cannot see. */}
      {/*
        Beneath the surface the only light is what filters down, so the key
        weakens and the fill takes on the water's colour rather than the sky's.
      */}
      <hemisphereLight
        args={[
          flags.under ? '#5c86a0' : palette.ambient,
          flags.under ? '#030a14' : palette.waterTint,
          palette.ambientIntensity * (flags.under ? 7 : 0.45),
        ]}
      />
      {/*
        The galaxy underfoot is a LIGHT, and it lights from below.

        With the sky emptied and the stars moved into the water, the brightest
        thing in the world is the ground — so this is a hemisphere light turned
        upside down: black overhead, starlight beneath. It rakes the undersides
        of the ring and the columns, which is the one direction nothing is ever
        lit from, and that wrongness is the whole point of the arrival. It is
        also the honest fix for "the ring is too dark": the ring was a pure
        silhouette because the only thing that could have lit it had been
        deleted from the sky, and the answer is to light it from the thing that
        replaced it rather than to quietly put the sky back.

        Scaled by the blend, so it arrives exactly as the stars do.
      */}
      <hemisphereLight args={['#000000', '#7fa8ff', nightLevel * 2.1]} />
      {/*
        A floor under the blacks, purely to stop the ring reading as a fault.

        Lit from below alone, the voussoirs came out a blue-and-black
        checkerboard: each block is set at its own slight angle, and against a
        single hard source from one direction that tiny difference flips a face
        between fully lit and fully unlit. The result looked like a broken
        texture rather than like stone. A weak omnidirectional fill compresses
        the gap between neighbouring blocks so the ring reads as one carved
        object, without putting any actual light back in the sky.
      */}
      <ambientLight color="#31527e" intensity={nightLevel * 0.7} />

      {/*
        The sun casts now. A shadow map covers a fixed volume, so the frustum
        is sized to the composition rather than to the whole world — spread
        over 1600 units every shadow would be a blurry smear, and tight to the
        piers they are crisp where anyone is looking.
      */}
      {/* Filtered daylight from above: cold, weak, straight down. */}
      {flags.under && (
        <directionalLight position={[10, 400, 40]} intensity={3.2} color="#6fb4cf" />
      )}

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
        {flags.under ? (
          <UnderWorld palette={palette} />
        ) : (
          <>
            {/* Drawn first, so the surface composites over it. */}
            <Mirror>
              <ArrayWorld palette={palette} mirrored />
            </Mirror>

            <Water
              palette={palette}
              roughness={config.waterRoughness}
              reflectorResolution={flags.noReflect ? 0 : quality.reflectorResolution}
              distort={rain ? 0.75 : 0.32}
              night={nightLevel}
            />
            <ArrayWorld palette={palette} />
          </>
        )}
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
        {/*
            AMBIENT OCCLUSION — OPT-IN, because it does not fit.

            It is the right effect for this scene and the largest single reason
            everything read as plastic: MeshStandardMaterial has no concept of
            a surface being enclosed, so the joint between two blocks and the
            gap where rubble meets rubble were lit exactly as brightly as a
            face pointing at open sky. Contact shadow is most of what the eye
            uses to decide whether it is looking at stone or at a render of it.

            MEASURED: 16.6ms without, 26.4ms with — on a 16.6ms budget it
            takes sixty percent of the frame and drops the scene from 60fps to
            about 38. Tuning did nothing; halfRes and quality="performance"
            came back at 26.4ms too, so the cost is the depth resolve rather
            than the sampling, and there is no setting that buys it back.

            This project has blown its frame budget three times on detail that
            looked worth it, so the effect stays behind ?ao=1 rather than
            being paid for by default. It also matters much less now that the
            portal is an authored asset whose maps already carry their own
            occlusion — the case for AO was strongest when every object in
            frame was untextured procedural geometry.
        */}
        {flags.ao ? (
          <N8AO aoRadius={2.4} intensity={2.2} distanceFalloff={1} quality="performance" halfRes />
        ) : <></>}
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
