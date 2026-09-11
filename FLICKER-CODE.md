# Source code — flicker investigation

Companion to FLICKER.md. Every file that touches rendering, camera motion,
materials or post-processing. Nothing else is included.

---

## `src/overlay/SceneCanvas.tsx`

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { Stage } from '@/world/Stage'
import { useScene } from '@/store/scene'
import { detectTier } from '@/lib/quality'

/**
 * The canvas host.
 *
 * Detects the device's capability once, before the first frame, and then
 * leaves the resolution alone.
 *
 * It used to run AdaptiveDpr and a PerformanceMonitor that stepped the pixel
 * ratio down whenever the frame rate dipped. That is a reasonable idea and a
 * terrible experience: every step resizes the drawing buffer, and on a scene
 * this dark each resize lands as a visible flash. A monitor that reacts to
 * dips caused by its own resizes then oscillates, and the whole page appears
 * to flicker. Pick a resolution from the device and hold it.
 */
export function SceneCanvas() {
  const setQuality = useScene((s) => s.setQuality)
  const setReducedMotion = useScene((s) => s.setReducedMotion)
  const maxDpr = useScene((s) => s.quality.maxDpr)
  const dpr = Math.max(
    1,
    Math.floor(Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio)),
  )

  const applyFlags = useScene((s) => s.applyFlags)

  useEffect(() => {
    applyFlags()
    setQuality(detectTier())

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)

    return () => mq.removeEventListener('change', onChange)
  }, [applyFlags, setQuality, setReducedMotion])

  return (
    <Canvas
      // Fixed for the session, never recomputed from frame timings, and always
      // an integer — floored against the device's own ratio so the framebuffer
      // maps 1:1 or 1:2 onto physical pixels rather than being resampled by a
      // fractional factor on its way to the panel.
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 56, near: 0.35, far: 6000, position: [0, 4.6, 58] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Stage />
    </Canvas>
  )
}
```

---

## `src/world/Stage.tsx`

```tsx
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
      <directionalLight ref={sunRef} castShadow={false} />

      <Suspense fallback={null}>
        <Water
          palette={palette}
          roughness={config.waterRoughness}
          reflectorResolution={flags.noReflect ? 0 : quality.reflectorResolution}
          distort={rain ? 0.5 : 0.16}
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
      <EffectComposer enableNormalPass={false} multisampling={4}>
        {quality.bloom && !flags.noBloom ? (
          <Bloom
            intensity={0.22}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.5}
            mipmapBlur
          />
        ) : (
          <></>
        )}
        {/* SMAA in ADDITION to the composer's multisampling.
            multisampling={8} should already cover geometry edges, but it is
            applied to the composer's own buffer and there is no guarantee it
            survives every driver and effect chain — and the flicker has
            outlived three separate theories. SMAA works on the resolved image
            regardless of how it was produced, so it catches edge crawl that
            MSAA missed. Cheap, and the one AA that cannot be silently
            discarded. */}
        <SMAA />
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
```

---

## `src/world/camera/IdleRig.tsx`

```tsx
'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useScene } from '@/store/scene'

/**
 * Resting camera behaviour.
 *
 * Two motions layered: a very slow orbital breath that never stops, and a
 * pointer parallax that leans the camera a few degrees toward the cursor. The
 * breath is what stops the opening shot feeling like a screenshot; the
 * parallax is what makes it feel like a place you are standing in.
 *
 * Disabled entirely under reduced motion — the framing stays, the movement goes.
 */

/**
 * Low, close, looking up.
 *
 * Standing height in the middle of the array reads as a diorama. Dropping the
 * lens to roughly a metre above the water and aiming it up past the near
 * monoliths is the whole trick: the foreground slabs run off the top of the
 * frame, and anything that leaves the frame reads as too big to contain.
 */
const REST = new Vector3(0, 4.6, 58)
const TARGET = new Vector3(0, 26, -76)

export function IdleRig() {
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const freelook = useScene((s) => s.freelook)
  const still = useScene((s) => s.flags.still)

  const lean = useRef(new Vector3())

  useFrame(({ clock }, delta) => {
    if (freelook) return

    if (reducedMotion || still) {
      camera.position.copy(REST)
      camera.lookAt(TARGET)
      return
    }

    const t = clock.elapsedTime

    // Orbital breath. Long periods, small amplitudes, deliberately irrational
    // ratios so the loop never visibly repeats.
    const breathX = Math.sin(t * 0.062) * 7.4 + Math.sin(t * 0.0211) * 3.0
    const breathY = Math.sin(t * 0.0431) * 1.4
    const breathZ = Math.cos(t * 0.0509) * 5.6

    // Pointer parallax, heavily damped.
    lean.current.x = MathUtils.damp(lean.current.x, pointer.x * 9.5, 1.9, delta)
    lean.current.y = MathUtils.damp(lean.current.y, pointer.y * 2.6, 1.9, delta)

    camera.position.set(
      REST.x + breathX + lean.current.x,
      REST.y + breathY + lean.current.y,
      REST.z + breathZ,
    )
    camera.lookAt(TARGET)
  })

  return null
}
```

---

## `src/world/atmosphere/Sky.tsx`

```tsx
'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  BackSide,
  Color,
  LinearMipmapLinearFilter,
  MirroredRepeatWrapping,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three'
import type { Palette } from './palette'
import type { AnimRef } from '../anim'
import { useScene } from '@/store/scene'

/**
 * The sky: a photographic panorama blended over a procedural base.
 *
 * Neither half works alone. A pure shader gradient is what made the first pass
 * read as synthetic — real skies carry cirrus detail that no cheap fbm
 * reproduces. A pure photograph, on the other hand, cannot move the sun, cannot
 * blend continuously between day and night, and cannot light the scene.
 *
 * So: the shader owns everything dynamic (gradient, sun disc, day/night mix,
 * the Milky Way), and the panorama supplies the detail the shader cannot fake.
 * The sun is composited ON TOP of the plate so it stays where the key light is,
 * rather than wherever it happened to be when the plate was generated.
 */

const vertex = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldDir = world.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform vec3      uZenith;
  uniform vec3      uHorizon;
  uniform vec3      uSunColor;
  uniform vec3      uSunDir;
  uniform float     uSunIntensity;
  uniform float     uNight;
  uniform float     uPlate;
  uniform float     uTime;
  uniform sampler2D uDusk;
  uniform sampler2D uNightMap;

  varying vec3 vWorldDir;

  const float PI = 3.14159265359;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -1.0, 1.0);
    float az = atan(dir.z, dir.x);

    /*
     * Seam-free azimuth for TEXTURE sampling.
     *
     * atan(z, x) jumps from +PI to -PI at the seam behind the camera. The GPU
     * picks a mip level by differencing neighbouring pixels' UVs, and across
     * that jump the difference is enormous — so it concludes the texture is
     * infinitely minified and drops to the blurriest mip. The result is a band
     * of mush that sweeps across the sky as the camera turns, present only
     * when the view is moving.
     *
     * acos of the normalised horizontal direction is continuous everywhere:
     * it folds front-to-back instead of wrapping, so there is no discontinuity
     * for the derivative to trip over. The fold mirrors the plate, which is
     * invisible in cirrus and is exactly what MirroredRepeatWrapping already
     * assumes. The raw az is still used for the procedural terms, which are
     * analytic and have no mip level to get wrong.
     */
    vec2 flat_dir = normalize(vec2(dir.x, dir.z) + vec2(1e-6));
    float azSafe = acos(clamp(flat_dir.x, -1.0, 1.0)) / PI;

    // --- procedural base -------------------------------------------------
    float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 0.55);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.30, 0.88, t));
    float haze = exp(-abs(h) * 16.0);
    col = mix(col, uHorizon, haze * 0.72);

    // --- photographic plate ----------------------------------------------
    // The dusk plate is a wide sky, not a true sphere, so it is mapped across
    // the upper hemisphere with mirrored wrap: repetition is invisible in
    // cirrus, whereas a hard seam would not be.
    float elev = clamp(asin(clamp(h, -1.0, 1.0)) / (PI * 0.5), 0.0, 1.0);

    // The dusk plate is a wide-angle sky photograph, not a hemisphere: its
    // frame spans roughly the first 50 degrees of elevation. Mapping it across
    // the full 0-90 stretched the amber horizon band over everything the
    // camera can actually see and buried the teal. Compress it to its true
    // arc and let the procedural zenith take over above.
    float plateElev = clamp(elev / 0.52, 0.0, 1.0);
    // The plate drifts. A static sky is half of why the world felt frozen;
    // real cirrus is always moving, just slowly enough that you notice it
    // only after a few seconds of looking.
    vec3 duskPlate = texture2D(uDusk, vec2(azSafe + uTime * 0.0016, plateElev)).rgb;

    // The plate was shot with a sun in it. Mirrored across the seam that sun
    // appears twice, and neither copy sits where our key light is — so roll
    // the highlights off hard. Everything below the knee (the cirrus, the
    // gradient, the grain) is untouched; only the blown disc is crushed.
    float plateLum = dot(duskPlate, vec3(0.2126, 0.7152, 0.0722));
    float over = max(plateLum - 0.62, 0.0);
    duskPlate /= 1.0 + over * 5.5;

    // A light tint so the plate still answers to the live palette, but not so
    // much that its own colour is overwritten.
    duskPlate = mix(duskPlate, duskPlate * mix(uHorizon, uZenith, 0.45) * 1.5, 0.26);

    // Strongest through the striation band; released toward the zenith so the
    // procedural teal closes the dome, and at the horizon where fog takes over.
    float plateMix = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.45, 0.92, elev)) * 0.88;
    col = mix(col, duskPlate, plateMix * (1.0 - uNight) * uPlate);

    // --- night ------------------------------------------------------------
    vec2 nightUv = vec2(azSafe + 0.5, clamp(elev / 0.85, 0.0, 1.0));
    vec3 stars = texture2D(uNightMap, nightUv).rgb;
    // Lift the plate's faint stars without lifting its black.
    stars = pow(stars, vec3(0.72)) * 1.45;
    col = mix(col, col * 0.25 + stars * uPlate, uNight * smoothstep(-0.03, 0.14, h));

    // Milky Way, kept procedural so it can be placed for composition rather
    // than wherever the plate put it.
    float band = exp(-pow(dot(dir, normalize(vec3(0.35, 0.62, 0.70))) * 3.1, 2.0));
    float dust = fbm(vec2(az * 2.4, h * 5.0) * 2.0);
    col += vec3(0.52, 0.55, 0.72) * band * dust * 0.34 * uNight;

    // --- sun, composited last so it always sits with the key light ---------
    float cosSun = dot(dir, normalize(uSunDir));
    float disc = smoothstep(0.99965, 0.99992, cosSun);
    float glow = pow(max(cosSun, 0.0), 420.0);
    float wide = pow(max(cosSun, 0.0), 40.0);
    col += uSunColor * (disc * 20.0 + glow * 1.15 + wide * 0.06) * uSunIntensity;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function Sky({ palette, anim }: { palette: Palette; anim: AnimRef }) {
  const noPlate = useScene((s) => s.flags.noPlate)
  const matRef = useRef<ShaderMaterial>(null)
  // Wrapping and colour space are configured in the loader callback rather
  // than after the fact: mutating a value returned from a hook is a React
  // Compiler violation, and this is the hook's own construction point.
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const [dusk, night] = useTexture(['/sky/dusk.jpg', '/sky/night.jpg'], (loaded) => {
    const list = (Array.isArray(loaded) ? loaded : [loaded]) as Texture[]
    list.forEach((tex, i) => {
      // The dusk plate is a wide sky rather than a full sphere, so it mirrors
      // across the seam. The night plate is a true equirect and simply wraps.
      tex.wrapS = i === 0 ? MirroredRepeatWrapping : RepeatWrapping
      tex.wrapT = RepeatWrapping
      tex.colorSpace = SRGBColorSpace
      // Without this the horizon band shimmers: the plate is extremely
      // compressed at grazing angles and single-sample mip selection flips
      // per pixel as the camera moves.
      tex.anisotropy = maxAniso
      tex.generateMipmaps = true
      tex.minFilter = LinearMipmapLinearFilter
      tex.needsUpdate = true
    })
  }) as Texture[]

  const uniforms = useMemo(() => {
    return {
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uSunColor: { value: new Color() },
      uSunDir: { value: new Vector3() },
      uSunIntensity: { value: 1 },
      uNight: { value: 0 },
      uPlate: { value: 1 },
      uTime: { value: 0 },
      uDusk: { value: dusk },
      uNightMap: { value: night },
    }
  }, [dusk, night])

  useFrame(({ clock }) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uZenith.value.copy(palette.skyZenith)
    u.uHorizon.value.copy(palette.skyHorizon)
    u.uSunColor.value.copy(palette.sunColor)
    u.uSunDir.value.copy(palette.sunDirection)
    u.uSunIntensity.value = palette.sunIntensity
    u.uNight.value = anim.current.night
    u.uPlate.value = noPlate ? 0 : 1
    u.uTime.value = clock.elapsedTime
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[2200, 64, 40]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        side={BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
```

---

## `src/world/array/Water.tsx`

```tsx
'use client'

import { useMemo, useRef } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Texture } from 'three'
import type { Palette } from '../atmosphere/palette'
import { rippleTexture } from '../materials/ripples'

/**
 * The salt plain: a centimetre of standing water over a flat bed.
 *
 * This single plane does most of the work in the reference frames. Every
 * vertical in the scene is doubled by it, which is what makes the monoliths
 * read as enormous.
 *
 * It was a PERFECT mirror, and a perfect mirror reads as polished stone, not
 * as water. What makes water look like water at this depth is not waves — it
 * is a slow, low-amplitude wander in the reflection. The distortion map drifts
 * continuously so the mirrored world breathes rather than sitting frozen.
 */
export function Water({
  palette,
  roughness,
  reflectorResolution,
  distort,
}: {
  palette: Palette
  roughness: number
  reflectorResolution: number
  /** Rain ripple amount. Low but never zero — still water still moves. */
  distort: number
}) {
  const reflective = reflectorResolution > 0
  const ripples = useMemo(() => rippleTexture(), [])
  const texRef = useRef<Texture>(ripples)

  useFrame(({ clock }) => {
    // Two axes at different rates, so the surface never repeats a state.
    const t = clock.elapsedTime
    texRef.current.offset.set(t * 0.0075, t * 0.0043)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      {/* Sized to sit inside the sky dome; beyond that the plain would render
          against nothing at all. */}
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          // Just enough to read as a centimetre of water rather than glass.
          //
          // This was [160,38] and then [90,22]; at those values the reflection
          // smeared into flat darkness and the mirrored plain — half the
          // composition — was simply absent.
          blur={[26, 7]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          mixStrength={6}
          roughness={roughness}
          // depthScale fades the reflection by distance from the surface, and
          // enabled it erased almost everything the plain should mirror.
          depthScale={0}
          color={palette.waterTint}
          metalness={1}
          mirror={1}
          distortion={distort}
          distortionMap={ripples}
          reflectorOffset={0}
        />
      ) : (
        <meshStandardMaterial color={palette.waterTint} roughness={Math.max(roughness, 0.35)} metalness={0.6} />
      )}
    </mesh>
  )
}
```

---

## `src/world/array/Monolith.tsx`

```tsx
'use client'

import { useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type MeshStandardMaterial } from 'three'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { concreteTiled } from '../materials/concrete'
import { useScene } from '@/store/scene'

/**
 * One slab.
 *
 * Near-black and barely reflective — in the reference frames these read almost
 * entirely as silhouette, and the thin specular along the lit edge is the only
 * thing telling you they are solid rather than holes cut out of the sky.
 *
 * Two things give them architecture rather than primitive-ness: the stepped
 * shoulder, and the cornice / plinth / reveal vocabulary of cast concrete.
 * All of it is silhouette-level, because that is how these are seen.
 *
 * The hover highlight is EASED, never snapped. Raycasting resolves against the
 * camera, so while the camera drifts the object under a stationary cursor
 * changes repeatedly and the hover state flips on and off. Applied instantly
 * that flip is a visible jump in the material — which is very probably the
 * flicker that only ever appeared with camera motion. Damping makes the state
 * change unobservable even when it oscillates.
 */
export function Monolith({
  placement,
  palette,
  emphasis = 0,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  placement: Placement
  palette: Palette
  /** 0 or 1. Target, not the applied value — see the easing note above. */
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, width, height, depth, shoulder, detail } = placement
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const noTex = useScene((s) => s.flags.noTex)

  // Horizontal tiling only; the vertical axis runs once so the waterline
  // stain sits at the base instead of repeating up the shaft.
  const map = useMemo(() => concreteTiled(width / 11, maxAniso), [width, maxAniso])
  const shoulderMap = useMemo(
    () => (shoulder ? concreteTiled((width * shoulder.width) / 11, maxAniso) : null),
    [width, shoulder, maxAniso],
  )

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)

  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 7, delta)
    const e = eased.current
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = e * 0.14
      m.roughness = 0.86 - e * 0.16
      m.envMapIntensity = 0.35 + e * 0.25
    }
  })

  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const material = (tex: typeof map) => (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      roughness={0.86}
      // Concrete is a dielectric: its metalness is zero, not nearly zero.
      // Any metalness at all makes the face mirror the environment map, and
      // that reflection changes with every camera move — correct physics, but
      // another thing that can only ever shimmer while the view is moving.
      metalness={0}
      // The environment still lights these; it just does not mirror in them.
      envMapIntensity={0.35}
      roughnessMap={noTex ? null : tex}
      emissive={palette.sunColor}
      emissiveIntensity={0}
    />
  )

  const handlers = {
    onPointerOver:
      onPointerOver &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onPointerOver()
      }),
    onPointerOut: onPointerOut && (() => onPointerOut()),
    onClick:
      onClick &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onClick()
      }),
  }

  const bevel = Math.min(0.3, width * 0.05)

  // Reveals: recessed horizontal bands where one lift of formwork met the next.
  const reveals = useMemo(() => {
    if (detail.reveals <= 0) return []
    return Array.from({ length: detail.reveals }, (_, i) => {
      const f = (i + 1) / (detail.reveals + 1)
      return { y: height * f - height / 2, thickness: height * 0.012 }
    })
  }, [detail.reveals, height])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[width, height, depth]} radius={bevel} smoothness={3} {...handlers}>
        {material(map)}
      </RoundedBox>

      {/* Cornice: a cap oversailing the shaft. Reads instantly as built. */}
      {detail.cornice > 0 && (
        <RoundedBox
          args={[width * (1 + detail.cornice), height * 0.035, depth * (1 + detail.cornice)]}
          radius={bevel * 0.5}
          smoothness={3}
          position={[0, height / 2 - height * 0.0175, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {/* Plinth: the base spreading where it meets the water. */}
      {detail.plinth > 0 && (
        <RoundedBox
          args={[width * (1 + detail.plinth), height * 0.05, depth * (1 + detail.plinth)]}
          radius={bevel * 0.5}
          smoothness={3}
          position={[0, -height / 2 + height * 0.025, 0]}
          {...handlers}
        >
          {material(map)}
        </RoundedBox>
      )}

      {/* Reveals, inset slightly so they catch a shadow line. */}
      {reveals.map((r, i) => (
        <mesh key={`reveal-${i}`} position={[0, r.y, 0]}>
          <boxGeometry args={[width * 0.985, r.thickness, depth * 0.985]} />
          {material(map)}
        </mesh>
      ))}

      {shoulder && (
        <RoundedBox
          args={[width * shoulder.width, height * shoulder.height, depth * 0.94]}
          radius={Math.min(0.26, width * 0.045)}
          smoothness={3}
          position={[
            (shoulder.side * (width + width * shoulder.width)) / 2 - shoulder.side * 0.35,
            (height * shoulder.height - height) / 2,
            0,
          ]}
          {...handlers}
        >
          {material(shoulderMap ?? map)}
        </RoundedBox>
      )}
    </group>
  )
}
```

---

## `src/world/materials/concrete.ts`

```tsx
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  ClampToEdgeWrapping,
  UnsignedByteType,
} from 'three'
import { createRng } from '@/lib/rng'

/**
 * Board-formed concrete, generated once at module load.
 *
 * Flat-coloured boxes were the giveaway that these were primitives. Real cast
 * concrete carries four things that survive being seen almost entirely in
 * shadow, which is how these slabs are seen:
 *
 *  - TIMBER GRAIN. Board-formed concrete is poured against rough sawn planks
 *    and takes their impression: horizontal bands with wood grain running
 *    through them and a hard shadow line at every board joint. This is the
 *    single most recognisable thing about brutalist concrete.
 *  - WEATHERING STREAKS where rain has run down the faces.
 *  - WATERLINE STAINING. Anything standing in water darkens for the first
 *    metre or so, and the tide line is sharp.
 *  - AGGREGATE. Fine stone grain under all of it.
 *
 * The map tiles HORIZONTALLY ONLY. Tiling vertically would repeat the
 * waterline stain up the shaft, which is why the vertical axis is clamped.
 */

const W = 256
const H = 1024 // tall, because the vertical axis is a single unrepeated run

function buildConcrete(): DataTexture {
  const rng = createRng(0x4f9c21)
  const data = new Uint8Array(W * H * 4)

  const lattice = (cells: number) => {
    const g = new Float32Array((cells + 1) * (cells + 1))
    for (let i = 0; i < g.length; i++) g[i] = rng()
    return (x: number, y: number) => {
      const fx = x * cells
      const fy = y * cells
      const x0 = Math.floor(fx) % cells
      const y0 = Math.floor(fy) % cells
      const tx = fx - Math.floor(fx)
      const ty = fy - Math.floor(fy)
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const at = (cx: number, cy: number) => g[(cy % cells) * (cells + 1) + (cx % cells)]
      const a = at(x0, y0)
      const b = at(x0 + 1, y0)
      const c = at(x0, y0 + 1)
      const d = at(x0 + 1, y0 + 1)
      return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy
    }
  }

  const aggregate = lattice(97)
  const coarse = lattice(13)
  const grainField = lattice(211)
  const streak = lattice(29)

  // Board layout: planks of slightly varying width, as real shuttering is.
  const BOARDS = 22
  const boardEdges: number[] = [0]
  for (let i = 0; i < BOARDS; i++) {
    boardEdges.push(boardEdges[i] + (0.8 + rng() * 0.4))
  }
  const span = boardEdges[boardEdges.length - 1]
  for (let i = 0; i < boardEdges.length; i++) boardEdges[i] /= span

  const boardAt = (v: number) => {
    for (let i = 0; i < boardEdges.length - 1; i++) {
      if (v >= boardEdges[i] && v < boardEdges[i + 1]) {
        return { index: i, t: (v - boardEdges[i]) / (boardEdges[i + 1] - boardEdges[i]) }
      }
    }
    return { index: BOARDS - 1, t: 0.5 }
  }

  for (let y = 0; y < H; y++) {
    const v = y / H
    const { index, t } = boardAt(v)

    for (let x = 0; x < W; x++) {
      const u = x / W

      let n = coarse(u, v) * 0.30 + aggregate(u, v) * 0.22 + 0.48

      // Timber grain: long horizontal fibres, offset per board so adjacent
      // planks never share a pattern.
      const grain = grainField(u * 0.35 + index * 0.31, v * 9.0)
      n += (grain - 0.5) * 0.16

      // Board joints. A hard dark line at each edge with a soft lip, which is
      // what actually reads at distance.
      const edge = Math.min(t, 1 - t)
      n -= Math.max(0, 1 - edge * 14) * 0.30

      // Rain streaks running down the face.
      const s = streak(u, v * 0.06)
      n -= Math.max(0, s - 0.58) * 0.42

      // Waterline. Sharp tide mark, darkening below it, heaviest at the base.
      const fromBase = v // v = 0 is the bottom of the shaft
      if (fromBase < 0.13) {
        const depth = 1 - fromBase / 0.13
        n -= depth * depth * 0.34
        // The tide line itself, a touch darker still.
        if (Math.abs(fromBase - 0.13) < 0.006) n -= 0.12
      }

      // Remap into a narrow band near the top of the range.
      //
      // roughnessMap MULTIPLIES roughness, and roughness also selects which
      // blurred mip of the ENVIRONMENT map a pixel samples. Wide variation
      // means neighbouring pixels choose different mips and those choices flip
      // as the camera moves — specular aliasing. Concrete is never glossy, so
      // the interest has to come from a whisper of variation.
      const banded = 0.82 + Math.max(0, Math.min(1, n)) * 0.16

      const v8 = Math.max(0, Math.min(255, Math.round(banded * 255)))
      const i = (y * W + x) * 4
      data[i] = v8
      data[i + 1] = v8
      data[i + 2] = v8
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  // Clamped: the waterline stain must occur once, at the bottom, not repeat.
  tex.wrapT = ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

let cached: DataTexture | null = null

function base(): DataTexture {
  cached ??= buildConcrete()
  return cached
}

/**
 * A view of the shared surface with its own horizontal tiling.
 *
 * repeat lives on the texture, not the mesh, so one shared instance cannot
 * tile differently per slab. Clones share the underlying image data.
 */
export function concreteTiled(repeatX: number, anisotropy = 8): DataTexture {
  const tex = base().clone()
  // Vertical repeat stays at 1 so the waterline happens once.
  tex.repeat.set(Math.max(1, Math.round(repeatX)), 1)
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}
```

---

## `src/world/materials/ripples.ts`

```tsx
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three'
import { createRng } from '@/lib/rng'

/**
 * A tiling distortion field for the water surface.
 *
 * A perfect mirror does not read as water — it reads as polished stone, which
 * is exactly the complaint. Real standing water has a slow-moving surface, and
 * what sells it is not big waves (this is a centimetre deep) but a very low
 * amplitude, long-wavelength disturbance that makes the reflection breathe
 * and wander instead of sitting frozen.
 *
 * Encoded as a two-channel offset in R and G, sampled by MeshReflectorMaterial
 * as a distortion map. Deliberately smooth: any high-frequency content here
 * would alias into the shimmer we just spent so long removing.
 */

const SIZE = 256

function buildRipples(): DataTexture {
  const rng = createRng(0x1c7e93)
  const data = new Uint8Array(SIZE * SIZE * 4)

  // Sum of a handful of directional sine waves at irrational frequency ratios,
  // so the pattern never visibly repeats within a tile.
  const waves = Array.from({ length: 6 }, () => ({
    angle: rng() * Math.PI * 2,
    freq: 1 + rng() * 3.2,
    phase: rng() * Math.PI * 2,
    amp: 0.35 + rng() * 0.65,
  }))

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * Math.PI * 2
      const v = (y / SIZE) * Math.PI * 2

      let dx = 0
      let dy = 0
      for (const w of waves) {
        const k = Math.cos(w.angle) * u * w.freq + Math.sin(w.angle) * v * w.freq
        const s = Math.sin(k + w.phase) * w.amp
        dx += Math.cos(w.angle) * s
        dy += Math.sin(w.angle) * s
      }

      const i = (y * SIZE + x) * 4
      // Remapped into 0-255 around a neutral 128, the no-offset value.
      data[i] = Math.max(0, Math.min(255, Math.round(128 + dx * 42)))
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 42)))
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

let cached: DataTexture | null = null

export function rippleTexture(): DataTexture {
  cached ??= buildRipples()
  return cached
}
```

---

## `src/lib/quality.ts`

```tsx
/**
 * Device capability detection -> quality tier.
 *
 * Decided once at boot, before the first frame, so the scene never has to
 * rebuild itself mid-session. Tiers are defined in the spec, section 6.
 */

export type Tier = 'high' | 'medium' | 'low'

export interface QualitySettings {
  tier: Tier
  /** Reflector render-target resolution. 0 disables reflection entirely. */
  reflectorResolution: number
  /** Multiplier applied to every scattered-particle count. */
  particleScale: number
  bloom: boolean
  depthOfField: boolean
  /** Upper bound for device pixel ratio. */
  maxDpr: number
  /** Rain is the most expensive optional system. */
  rainEnabled: boolean
}

const SETTINGS: Record<Tier, Omit<QualitySettings, 'tier'>> = {
  high: {
    // 1024, not 2048.
    //
    // 512 stair-stepped the reflected edges; 2048 cost roughly 70fps. At DPR 2
    // the reflector renders the whole scene again into a 2048 target every
    // frame, and that plus 8x multisampling took a locked 120fps down to a
    // juddering 43-50 — which, on a 120Hz panel, is what the "flicker"
    // actually was. 1024 is sharp enough and affordable.
    reflectorResolution: 1024,
    particleScale: 1,
    bloom: true,
    depthOfField: true,
    // MUST be an integer.
    //
    // A fractional pixel ratio means the browser resamples every frame by a
    // non-integer factor on the way to the panel. Standing still that is
    // invisible; in motion each edge lands on a different sub-pixel phase
    // every frame and shimmers. It survived every other fix because it is not
    // in the scene at all — it is the scale between the framebuffer and the
    // display.
    maxDpr: 2,
    rainEnabled: true,
  },
  medium: {
    reflectorResolution: 1024,
    particleScale: 0.5,
    bloom: true,
    depthOfField: false,
    maxDpr: 1,
    rainEnabled: true,
  },
  low: {
    // Still reflective, just cheaply. Losing the mirror is losing the world.
    reflectorResolution: 512,
    particleScale: 0.25,
    bloom: false,
    depthOfField: false,
    maxDpr: 1,
    rainEnabled: false,
  },
}

export function settingsFor(tier: Tier): QualitySettings {
  return { tier, ...SETTINGS[tier] }
}

/** Inputs to tier selection, extracted so the decision itself stays testable. */
export interface DeviceProfile {
  /** navigator.deviceMemory in GB, undefined when unreported. */
  deviceMemory?: number
  hardwareConcurrency: number
  /** WEBGL_debug_renderer_info UNMASKED_RENDERER_WEBGL, lowercased. */
  renderer: string
  /** Coarse pointer implies touch, which implies a mobile GPU. */
  coarsePointer: boolean
  prefersReducedMotion: boolean
}

/**
 * Pure, so it can be unit-tested against known device profiles rather than
 * only discovered on real hardware.
 */
export function selectTier(p: DeviceProfile): Tier {
  // NOTE: prefers-reduced-motion deliberately does NOT affect the tier.
  //
  // An earlier version returned 'low' for it, which silently disabled the
  // water reflection — and since the key light rakes in almost horizontally, a
  // flat unlit plane renders BLACK. Anyone with Reduce Motion enabled lost the
  // entire mirrored plain, which is half the composition. Reduced motion is a
  // request to stop things MOVING; it says nothing about the GPU. It is
  // handled in the camera rig and the animated systems instead.

  // Software renderers appear in CI and in browsers with GPU blocklists. They
  // cannot sustain a reflector at any resolution.
  if (/swiftshader|llvmpipe|softwarerasterizer|angle \(software/.test(p.renderer)) {
    return 'low'
  }

  const weakMemory = p.deviceMemory !== undefined && p.deviceMemory <= 4
  const weakCpu = p.hardwareConcurrency <= 4

  if (p.coarsePointer) {
    // Mobile. Apple's mobile GPUs carry a reflector at half res; most others do not.
    return /apple/.test(p.renderer) && !weakMemory ? 'medium' : 'low'
  }

  if (weakMemory || weakCpu) return 'medium'
  return 'high'
}

/** Reads the live browser environment. Returns 'medium' during SSR. */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'medium'

  let renderer = ''
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 'low'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase()
  } catch {
    return 'low'
  }

  return selectTier({
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    renderer,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
}

/** True when WebGL is unavailable and the text fallback must be served instead. */
export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
```

---

## `src/world/FlickerProbe.tsx`

```tsx
'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'

/**
 * Objective flicker measurement.
 *
 * "It is still flickering" and a locked 120fps cannot both be acted on without
 * turning the symptom into a number. Every frame this reads back a small block
 * of the composed framebuffer, computes its mean luminance, and tracks how much
 * that mean moves between consecutive frames.
 *
 * A stable image sits near zero. Anything that redraws differently each frame —
 * per-frame noise, crawling aliased edges, an unstable bloom on a sub-pixel
 * highlight — shows up as a spike, and the three sample regions say roughly
 * WHERE, which is the part guessing could never supply.
 *
 * readPixels stalls the pipeline, so this only runs behind ?flicker=1.
 */

const BLOCK = 24

export function FlickerProbe({ onSample }: { onSample: (deltas: number[]) => void }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  // A ref, not a memo: the probe accumulates across frames, and mutating a
  // value returned from useMemo is a React Compiler violation.
  const stateRef = useRef({
    buf: new Uint8Array(BLOCK * BLOCK * 4),
    last: [0, 0, 0],
    peak: [0, 0, 0],
    frames: 0,
  })

  useFrame(() => {
    const state = stateRef.current
    const ctx = gl.getContext()
    const dpr = gl.getPixelRatio()
    const w = Math.floor(size.width * dpr)
    const h = Math.floor(size.height * dpr)

    // Sky, the slab faces, and the mirrored plain — the three places an
    // artefact could plausibly live.
    const regions: [number, number][] = [
      [Math.floor(w * 0.5), Math.floor(h * 0.78)],
      [Math.floor(w * 0.18), Math.floor(h * 0.45)],
      [Math.floor(w * 0.5), Math.floor(h * 0.18)],
    ]

    regions.forEach(([x, y], i) => {
      ctx.readPixels(x, y, BLOCK, BLOCK, ctx.RGBA, ctx.UNSIGNED_BYTE, state.buf)
      let sum = 0
      for (let p = 0; p < state.buf.length; p += 4) {
        sum += 0.2126 * state.buf[p] + 0.7152 * state.buf[p + 1] + 0.0722 * state.buf[p + 2]
      }
      const mean = sum / (BLOCK * BLOCK)
      const delta = Math.abs(mean - state.last[i])
      // Ignore the first frames: shader compilation and texture upload make
      // the opening moments unrepresentative.
      if (state.frames > 30) state.peak[i] = Math.max(state.peak[i], delta)
      state.last[i] = mean
    })

    state.frames++
    if (state.frames % 30 === 0) onSample([...state.peak])
  })

  return null
}
```

---

## `src/world/atmosphere/palette.ts`

```tsx
import { Color, Vector3 } from 'three'

/**
 * The palette, sampled from the approved concept frames.
 *
 * Every colour in the scene resolves from here. Fog in particular MUST equal
 * the sky's horizon colour — if the two drift apart, distant geometry reads as
 * pasted onto the sky instead of receding into it, and the entire sense of
 * scale collapses.
 */

export interface Palette {
  skyZenith: Color
  skyHorizon: Color
  sunColor: Color
  /** Direction TO the sun, normalized. */
  sunDirection: Vector3
  /** Brightness of the sun DISC in the sky shader. Wants to be large. */
  sunIntensity: number
  /** Brightness of the directional key light on geometry. Deliberately
   *  separate: the sky needs a blown-out sun, the monoliths need to stay in
   *  silhouette, and one number cannot serve both. */
  keyIntensity: number
  /**
   * Derived from the sky, but pulled toward the zenith rather than set equal
   * to the horizon. Real aerial perspective cools with distance — matching the
   * warm horizon exactly turned every distant monolith cream instead of
   * letting it recede into haze.
   */
  fog: Color
  fogDensityScale: number
  monolith: Color
  /** Tint multiplied into the water's reflection. Slightly darker than 1 reads
   *  as water rather than as a mirror. */
  waterTint: Color
  ambient: Color
  ambientIntensity: number
}

export const DAY: Palette = {
  skyZenith: new Color('#4b6d76'),
  skyHorizon: new Color('#ecdcb9'),
  sunColor: new Color('#ffd8a0'),
  sunDirection: new Vector3(0.44, 0.04, -0.90).normalize(),
  sunIntensity: 3.4,
  keyIntensity: 0.85,
  fog: new Color('#b6bda6'),
  fogDensityScale: 1,
  monolith: new Color('#020304'),
  waterTint: new Color('#e8ece7'),
  ambient: new Color('#5d7a80'),
  ambientIntensity: 0.17,
}

export const NIGHT: Palette = {
  skyZenith: new Color('#03060f'),
  skyHorizon: new Color('#16273f'),
  sunColor: new Color('#9fb6d8'),
  // The "sun" at night is the moon, low and opposite the day sun.
  sunDirection: new Vector3(-0.45, 0.22, 0.86).normalize(),
  sunIntensity: 0.35,
  keyIntensity: 0.14,
  fog: new Color('#0e1c2e'),
  fogDensityScale: 1.35,
  monolith: new Color('#010203'),
  waterTint: new Color('#7d8ea8'),
  ambient: new Color('#16304f'),
  ambientIntensity: 0.14,
}

/** Linear blend between the two palettes. `t` of 0 is day, 1 is night. */
export function blendPalette(t: number, out: Palette): Palette {
  out.skyZenith.copy(DAY.skyZenith).lerp(NIGHT.skyZenith, t)
  out.skyHorizon.copy(DAY.skyHorizon).lerp(NIGHT.skyHorizon, t)
  out.sunColor.copy(DAY.sunColor).lerp(NIGHT.sunColor, t)
  out.sunDirection.copy(DAY.sunDirection).lerp(NIGHT.sunDirection, t).normalize()
  out.sunIntensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * t
  out.keyIntensity = DAY.keyIntensity + (NIGHT.keyIntensity - DAY.keyIntensity) * t
  out.fog.copy(out.skyHorizon).lerp(out.skyZenith, 0.42)
  out.fogDensityScale = DAY.fogDensityScale + (NIGHT.fogDensityScale - DAY.fogDensityScale) * t
  out.monolith.copy(DAY.monolith).lerp(NIGHT.monolith, t)
  out.waterTint.copy(DAY.waterTint).lerp(NIGHT.waterTint, t)
  out.ambient.copy(DAY.ambient).lerp(NIGHT.ambient, t)
  out.ambientIntensity =
    DAY.ambientIntensity + (NIGHT.ambientIntensity - DAY.ambientIntensity) * t
  return out
}

/** A mutable palette instance for the render loop to write into each frame. */
export function createPalette(): Palette {
  return {
    skyZenith: DAY.skyZenith.clone(),
    skyHorizon: DAY.skyHorizon.clone(),
    sunColor: DAY.sunColor.clone(),
    sunDirection: DAY.sunDirection.clone(),
    sunIntensity: DAY.sunIntensity,
    keyIntensity: DAY.keyIntensity,
    fog: DAY.fog.clone(),
    fogDensityScale: DAY.fogDensityScale,
    monolith: DAY.monolith.clone(),
    waterTint: DAY.waterTint.clone(),
    ambient: DAY.ambient.clone(),
    ambientIntensity: DAY.ambientIntensity,
  }
}
```

---

## `src/world/atmosphere/Birds.tsx`

```tsx
'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import type { Palette } from './palette'

/**
 * Birds wheeling over the plain.
 *
 * The world was inert. A camera breath alone is not life — the eye needs
 * something with its own intent moving through the frame, and a still image
 * with a drifting camera still reads as a photograph rather than a place.
 *
 * Deliberately distant silhouettes: at this range a bird is a few dark pixels
 * with a wingbeat, so two angled planes per bird is the whole model. They
 * travel long elliptical circuits at different rates and heights, so the
 * flock never forms a visible pattern and never all leaves frame at once.
 */
interface Bird {
  radius: number
  height: number
  speed: number
  phase: number
  tilt: number
  scale: number
  beat: number
}

export function Birds({ count = 16, palette }: { count?: number; palette: Palette }) {
  const group = useRef<Group>(null)

  const birds = useMemo<Bird[]>(() => {
    const rng = createRng(SEED.stars + 41)
    return Array.from({ length: count }, () => ({
      // Closer and lower than before: at 90-260 units out and 88 up they were
      // a few pixels near the zenith, which is not where anyone is looking.
      radius: range(rng, 55, 190),
      height: range(rng, 26, 62),
      // Slow. A bird crossing the frame in two seconds reads as an insect.
      speed: range(rng, 0.022, 0.055) * (rng() < 0.5 ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      tilt: range(rng, -0.22, 0.22),
      scale: range(rng, 1.5, 3.4),
      beat: range(rng, 2.6, 4.4),
    }))
  }, [count])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime

    g.children.forEach((child, i) => {
      const b = birds[i]
      const a = b.phase + t * b.speed
      child.position.set(
        Math.cos(a) * b.radius,
        b.height + Math.sin(a * 2.3 + b.phase) * 4.5,
        Math.sin(a) * b.radius - 105,
      )
      // Face along the tangent of travel.
      child.rotation.set(b.tilt, -a + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2), 0)

      // Wingbeat: the two wing planes fold and open.
      const flap = Math.sin(t * b.beat + b.phase) * 0.55
      const [left, right] = child.children
      if (left && right) {
        left.rotation.z = 0.35 + flap
        right.rotation.z = -0.35 - flap
      }
    })
  })

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} scale={b.scale}>
          {[1, -1].map((side) => (
            <mesh key={side} position={[side * 0.5, 0, 0]}>
              <planeGeometry args={[1.6, 0.26]} />
              <meshBasicMaterial
                color={palette.monolith}
                side={DoubleSide}
                transparent
                opacity={0.85}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
```

---

## `package.json` (dependencies)

```json
{
  "dependencies": {
    "@react-three/drei": "^10.7.8",
    "@react-three/fiber": "^9.7.0",
    "@react-three/postprocessing": "^3.1.1",
    "next": "16.3.5",
    "postprocessing": "^6.39.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "three": "^0.186.0",
    "zod": "^4.6.2",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^24.13.4",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.186.0",
    "@vitejs/plugin-react": "^6.1.1",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^5.0.0"
  }
}
```
