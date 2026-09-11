'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
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
 * World composition and grade.
 *
 * The realism pass shifts lighting away from "everything is environment fill"
 * toward a readable key/fill ratio. Four hero monoliths cast a controlled
 * 2048px shadow map; the distant scatter stays non-casting so the cost remains
 * predictable at 120 Hz.
 */
export function Stage() {
  const night = useScene((s) => s.night)
  const config = useScene((s) => s.config)
  const quality = useScene((s) => s.quality)
  const rain = useScene((s) => s.rain)
  const moteCount = useScene((s) =>
    effectiveMoteCount({ config: s.config, quality: s.quality }),
  )
  const flags = useScene((s) => s.flags)
  const setFlicker = useScene((s) => s.setFlicker)

  const palette = useMemo(() => createPalette(), [])
  const animRef = useRef<Anim>(createAnim())
  const sunRef = useRef<DirectionalLight>(null)
  const fogRef = useRef<FogExp2>(null)

  useFrame((_, delta) => {
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
      <fogExp2
        ref={fogRef}
        attach="fog"
        args={[palette.fog.getHex(), CONFIG_DEFAULTS.fogDensity]}
      />

      {/* IBL supplies broad sky fill; it is intentionally weaker than before
          so the key can reveal form instead of every face receiving the same
          flat illumination. */}
      <Environment files="/sky/dusk.jpg" background={false} environmentIntensity={0.86} />
      <Sky palette={palette} anim={animRef} />

      <hemisphereLight
        args={[palette.ambient, palette.waterTint, palette.ambientIntensity * 0.62]}
      />
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={900}
        shadow-camera-left={-175}
        shadow-camera-right={175}
        shadow-camera-top={175}
        shadow-camera-bottom={-175}
        shadow-bias={-0.00008}
        shadow-normalBias={0.035}
      />

      <Suspense fallback={null}>
        <Water
          palette={palette}
          roughness={config.waterRoughness}
          reflectorResolution={flags.noReflect ? 0 : quality.reflectorResolution}
          distort={rain ? 0.26 : 0.075}
        />
        <ArrayWorld palette={palette} />
      </Suspense>

      <Motes count={flags.noMotes ? 0 : moteCount} palette={palette} />
      {!flags.still && <Birds palette={palette} />}
      <IdleRig />

      {flags.probe && <FlickerProbe onSample={setFlicker} />}

      {flags.noPost ? null : (
        <EffectComposer enableNormalPass={false} multisampling={4}>
          {quality.bloom && !flags.noBloom ? (
            <Bloom
              intensity={0.12}
              luminanceThreshold={0.86}
              luminanceSmoothing={0.42}
              mipmapBlur
            />
          ) : (
            <></>
          )}
          <SMAA />
          {/* The old vignette was doing a large part of the art direction by
              crushing edges. The reference look is atmospheric, not a heavy
              post filter, so keep this barely perceptible. */}
          <Vignette offset={0.28} darkness={0.38} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  )
}
