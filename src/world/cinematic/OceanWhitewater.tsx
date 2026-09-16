'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ShaderMaterial, type Mesh } from 'three'
import { cinematicClock } from './cinematicState'

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

/**
 * FULL-OCEAN WHITEWATER PASS.
 *
 * OceanChaos already owns the violent local event around the gate. This layer
 * does something different: once the cinematic starts, the REST of the ocean
 * joins it. The whole visible surface becomes rough, broken and white-capped
 * instead of leaving a calm blue sheet around one isolated foam patch.
 *
 * It is intentionally translucent. The real Water material still supplies the
 * reflections and depth; this pass supplies displaced crest geometry + broken
 * whitewater on top of it.
 */
export function OceanWhitewater() {
  const mesh = useRef<Mesh>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uAmount: { value: 0 },
          uRed: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vHeight;
          varying float vRidge;

          uniform float uTime;
          uniform float uAmount;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          float ridge(vec2 p) {
            return 1.0 - abs(noise(p) * 2.0 - 1.0);
          }

          void main() {
            vUv = uv;
            vec2 p = uv * 2.0 - 1.0;

            // Several wave families crossing each other keeps the full ocean
            // from turning into one repeating sine sheet.
            float longA = sin((p.y * 15.0) - uTime * 1.18 + sin(p.x * 5.0) * 0.9);
            float longB = sin((p.x * 11.0 + p.y * 7.0) + uTime * 0.88);
            float chopA = ridge(p * 9.5 + vec2(uTime * 0.26, -uTime * 0.21));
            float chopB = ridge(p * 21.0 + vec2(-uTime * 0.47, uTime * 0.39));
            float chopC = ridge(p * 43.0 + vec2(uTime * 0.71, uTime * 0.58));

            float ridgeField =
              longA * 0.52 +
              longB * 0.28 +
              (chopA - 0.55) * 1.55 +
              (chopB - 0.56) * 0.88 +
              (chopC - 0.57) * 0.42;

            // Broad storm heave + sharp local chop. Enough geometry to catch
            // the eye in the foreground without becoming giant vertical walls.
            float height = ridgeField * (0.45 + uAmount * 2.75) * uAmount;

            vec3 pos = position;
            // local +Z becomes world +Y after mesh rotation
            pos.z += height;

            vHeight = height;
            vRidge = ridgeField;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying float vHeight;
          varying float vRidge;

          uniform float uTime;
          uniform float uAmount;
          uniform float uRed;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          void main() {
            vec2 p = vUv * 2.0 - 1.0;

            // Broken white caps across the ENTIRE visible sea. The threshold is
            // intentionally noisy so this reads as torn water, not zebra stripes.
            float grainA = noise(p * 34.0 + vec2(uTime * 0.37, -uTime * 0.29));
            float grainB = noise(p * 71.0 + vec2(-uTime * 0.61, uTime * 0.52));
            float crest = smoothstep(0.55, 1.95, vHeight + max(vRidge, 0.0) * 0.75);
            float broken = smoothstep(0.42, 0.79, grainA * 0.72 + grainB * 0.28);
            float foam = crest * broken;

            // Some thinner torn streaks live below the actual highest crests,
            // which is what makes the ocean feel full of whitewater rather than
            // a few isolated bright wave tops.
            float streak = abs(sin(p.y * 73.0 + p.x * 17.0 - uTime * 2.1));
            streak = pow(1.0 - smoothstep(0.76, 0.98, streak), 2.0);
            streak *= smoothstep(0.35, 0.78, grainA);

            float whitewater = clamp(foam * 0.92 + streak * 0.34, 0.0, 1.0) * uAmount;

            vec3 cold = vec3(0.72, 0.83, 0.88);
            vec3 white = vec3(0.96, 0.975, 0.985);
            vec3 colour = mix(cold, white, clamp(whitewater * 1.25, 0.0, 1.0));

            // Red only catches the highest whitewater later in the sequence.
            // It does not paint the full sea red.
            vec3 red = vec3(0.88, 0.018, 0.007);
            float redCatch = uRed * whitewater * smoothstep(0.72, 1.65, vHeight);
            colour = mix(colour, red, clamp(redCatch * 0.58, 0.0, 0.58));

            // Keep the base ocean visible between crests. The eye reads this as
            // real reflective water underneath turbulent whitewater geometry.
            float body = smoothstep(0.35, 1.0, uAmount) * 0.075;
            float alpha = body + whitewater * 0.55;

            // Feather the very outside of the giant plane so its rectangular
            // boundary can never become visible at an oblique camera angle.
            float edge = 1.0 - smoothstep(0.82, 1.0, max(abs(p.x), abs(p.y)));
            alpha *= edge;

            if (alpha < 0.004) discard;
            gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.62));
          }
        `,
      }),
    [],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const t = cinematicClock.elapsed

    // The whole ocean wakes almost immediately after F, is fully rough before
    // the local portal pull peaks, and eases away only when the camera is about
    // to leave the exterior world. Running the master clock backward naturally
    // reverses this envelope for the night -> day trip.
    const rise = span(t, 0.28, 2.15)
    const clear = 1 - span(t, 10.35, 11.75) * 0.82
    const amount = rise * clear
    const red = span(t, 5.55, 7.55)

    material.uniforms.uTime.value += delta
    material.uniforms.uAmount.value = amount
    material.uniforms.uRed.value = red

    if (mesh.current) mesh.current.visible = amount > 0.008
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <mesh
      ref={mesh}
      position={[0, 0.14, -125]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      renderOrder={12}
    >
      <planeGeometry args={[1050, 1050, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
