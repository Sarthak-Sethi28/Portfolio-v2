'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three'
import type { Palette } from './palette'
import type { AnimRef } from '../anim'

/**
 * Procedural sky.
 *
 * Deliberately not an HDRI. The spec originally called for Poly Haven files,
 * but a shader wins here on three counts: it costs zero bytes so first paint
 * is immediate, it hits the concept palette exactly rather than approximately,
 * and day/night becomes a continuous uniform rather than a cross-fade between
 * two multi-megabyte textures. Image-based lighting is not missed in a scene
 * built almost entirely from silhouettes and fog.
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

  uniform vec3  uZenith;
  uniform vec3  uHorizon;
  uniform vec3  uSunColor;
  uniform vec3  uSunDir;
  uniform float uSunIntensity;
  uniform float uNight;
  uniform float uTime;

  varying vec3 vWorldDir;

  // Cheap value noise, used only for the soft cloud banding near the horizon.
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

  // Star field for the night half. Hashed to a fixed grid so stars do not
  // swim when the camera moves.
  float stars(vec3 dir) {
    vec3 g = dir * 220.0;
    vec3 id = floor(g);
    float h = hash(id.xy + id.z * 57.0);
    if (h < 0.9965) return 0.0;
    vec3 f = fract(g) - 0.5;
    float d = length(f);
    float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + h * 90.0);
    return smoothstep(0.34, 0.0, d) * twinkle;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);

    // Height ramp. pow() biases the gradient down toward the horizon, which is
    // where all the colour interest lives in the reference frames.
    float h = clamp(dir.y, -1.0, 1.0);
    float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 0.55);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.30, 0.88, t));

    // Horizon haze: a bright band hugging y = 0 that sells atmospheric depth.
    // Kept tight, or it swallows the zenith and the sky reads as one flat wash.
    float haze = exp(-abs(h) * 16.0);
    col = mix(col, uHorizon, haze * 0.72);

    // Sun. A small hot disc inside a very wide, very soft bloom.
    float cosSun = dot(dir, normalize(uSunDir));
    float disc  = smoothstep(0.9993, 0.99985, cosSun);
    float glow  = pow(max(cosSun, 0.0), 260.0);
    float wide  = pow(max(cosSun, 0.0), 26.0);
    col += uSunColor * (disc * 18.0 + glow * 1.9 + wide * 0.34) * uSunIntensity;

    // Cloud banding, compressed toward the horizon and drifting slowly.
    vec2 cuv = vec2(atan(dir.z, dir.x) * 1.35, h * 3.4);
    float cloud = fbm(cuv * 1.6 + vec2(uTime * 0.006, 0.0));
    cloud = smoothstep(0.46, 0.92, cloud) * smoothstep(0.62, 0.05, abs(h));
    col = mix(col, uHorizon * 1.12, cloud * 0.42 * (1.0 - uNight * 0.55));

    // Stars fade in with the night mix, above the horizon only.
    col += vec3(0.85, 0.9, 1.0) * stars(dir) * uNight * smoothstep(-0.02, 0.16, h);

    // Milky Way: a broad tilted band of dust, the payoff of night mode.
    float band = exp(-pow((dot(dir, normalize(vec3(0.35, 0.62, 0.70)))) * 3.1, 2.0));
    float dust = fbm(vec2(atan(dir.z, dir.x) * 2.4, h * 5.0) * 2.0);
    col += vec3(0.52, 0.55, 0.72) * band * dust * 0.30 * uNight;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function Sky({ palette, anim }: { palette: Palette; anim: AnimRef }) {
  const matRef = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uSunColor: { value: new Color() },
      uSunDir: { value: new Vector3() },
      uSunIntensity: { value: 1 },
      uNight: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  )

  // Uniforms are written in the frame loop, never during render: Stage owns
  // the palette blend and `anim` carries the live night mix across without
  // either component reading a ref while rendering.
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
      <sphereGeometry args={[900, 48, 32]} />
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
