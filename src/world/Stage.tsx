'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { MathUtils, type DirectionalLight, type FogExp2 } from 'three'
import { CONFIG_DEFAULTS, useScene, effectiveMoteCount } from '@/store/scene'
import { blendPalette, createPalette } from './atmosphere/palette'
import { Sky } from './atmosphere/Sky'
import { Motes } from './atmosphere/Motes'
import { Water } from './array/Water'
import { ArrayWorld } from './array/ArrayWorld'
import { IdleRig } from './camera/IdleRig'
import { createAnim, type Anim } from './anim'

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

  const palette = useMemo(() => createPalette(), [])
  const animRef = useRef<Anim>(createAnim())
  const sunRef = useRef<DirectionalLight>(null)

  const fogRef = useRef<FogExp2>(null)

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
      sunRef.current.position
        .copy(palette.sunDirection)
        .multiplyScalar(420)
      sunRef.current.color.copy(palette.sunColor)
      sunRef.current.intensity = palette.sunIntensity
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

      <Sky palette={palette} anim={animRef} />

      <hemisphereLight
        args={[palette.ambient, palette.waterTint, palette.ambientIntensity]}
      />
      <directionalLight ref={sunRef} castShadow={false} />

      <Suspense fallback={null}>
        <Water
          palette={palette}
          roughness={config.waterRoughness}
          reflectorResolution={quality.reflectorResolution}
          distort={rain ? 0.32 : 0.04}
        />
        <ArrayWorld palette={palette} />
      </Suspense>

      <Motes count={moteCount} palette={palette} />
      <IdleRig />

      <EffectComposer enableNormalPass={false}>
        {quality.bloom ? (
          <Bloom
            intensity={0.62}
            luminanceThreshold={0.68}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        ) : (
          <></>
        )}
        <Vignette offset={0.2} darkness={0.78} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
