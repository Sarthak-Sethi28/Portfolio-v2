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
    vec3 duskPlate = texture2D(uDusk, vec2(az / (2.0 * PI), plateElev)).rgb;

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
    col = mix(col, duskPlate, plateMix * (1.0 - uNight));

    // --- night ------------------------------------------------------------
    vec2 nightUv = vec2(az / (2.0 * PI) + 0.5, clamp(elev / 0.85, 0.0, 1.0));
    vec3 stars = texture2D(uNightMap, nightUv).rgb;
    // Lift the plate's faint stars without lifting its black.
    stars = pow(stars, vec3(0.72)) * 1.45;
    col = mix(col, col * 0.25 + stars, uNight * smoothstep(-0.03, 0.14, h));

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
