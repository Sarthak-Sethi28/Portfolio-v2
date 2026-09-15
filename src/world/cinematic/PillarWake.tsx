'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ShaderMaterial, type Mesh } from 'three'
import { cinematicClock } from './cinematicState'
import { waterline } from './waterline'

const SLOTS = 4

/**
 * Four local water fields, one for each hero column.
 *
 * The new timing matters as much as the shader: the pillars now fall AFTER the
 * red water front reaches them, so their wakes must live around 9-11.8 seconds,
 * not around the old 4-7 second beat. Each patch follows the real waterline
 * published by ModelPier and briefly catches red as that pillar first yields.
 */
export function PillarWake() {
  const meshes = useRef<(Mesh | null)[]>([])

  const makeShader = () => ({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDepth: { value: 0 },
      uAmount: { value: 0 },
      uRed: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uDepth;
      uniform float uAmount;
      uniform float uRed;

      float ring(float r, float c, float w) {
        return exp(-pow((r - c) / w, 2.0));
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float rim = 0.17 + uDepth * 0.06;
        float lead = uDepth * 0.55 + 0.06;

        // Low, broad displacement: these structures are massive, so the water
        // is shoved rather than sprayed high into the air.
        float pressure = ring(r, rim + lead * 0.6, 0.22) * (1.0 - uDepth * 0.3);

        float n1 = noise(p * 22.0 + uTime * 1.1);
        float n2 = noise(p * 46.0 - uTime * 1.7);
        float churn = smoothstep(0.18, 0.78, n1 * 0.65 + n2 * 0.45);
        float collar = ring(r, rim, 0.13);
        float foam = collar * churn * (1.15 + uDepth * 1.3);

        // Water closes over the crown at the end instead of ending on a clean cut.
        float suck = smoothstep(0.72, 1.0, uDepth) * ring(r, rim * 0.7, 0.10) * 0.7;
        float h = pressure * 0.8 + foam + suck;

        vec3 water = vec3(0.48, 0.57, 0.70);
        vec3 whitewater = vec3(0.97, 0.99, 1.0);
        vec3 redLight = vec3(0.78, 0.035, 0.012);

        vec3 col = mix(water, whitewater, min(1.0, foam * 1.9));
        // Only the first part of the descent is red: the travelling surface
        // front hits, the stone yields, then the wake becomes ordinary water.
        col = mix(col, redLight, uRed * (0.18 + pressure * 0.30));

        float a = min(h * uAmount * 2.1, 0.95);
        gl_FragColor = vec4(col, a);
      }
    `,
  })

  const materials = useMemo(
    () => Array.from({ length: SLOTS }, () => new ShaderMaterial(makeShader())),
    [],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const et = cinematicClock.elapsed

    // Hold the churn until the final pillar is gone, then let the sea calm in
    // the half-second breath before the camera starts being pulled forward.
    const settle = et <= 10.75 ? 1 : Math.max(0, 1 - (et - 10.75) / 1.05)

    let i = 0
    for (const w of waterline.values()) {
      if (i >= SLOTS) break
      const g = meshes.current[i]
      const m = materials[i]
      i++
      if (!g || !m) continue

      m.uniforms.uTime.value += delta
      m.uniforms.uDepth.value = w.depth

      const active = w.depth > 0.001 && w.depth < 0.999
      const residual = w.depth >= 0.999 ? 0.45 : 0
      const amount = active ? Math.min(1, w.depth * 3.2) : residual

      // A short red contact beat exactly as the column begins moving. It makes
      // the causal chain legible without painting the whole splash red.
      const redIn = Math.max(0, Math.min(1, (w.depth - 0.01) / 0.08))
      const redOut = 1 - Math.max(0, Math.min(1, (w.depth - 0.24) / 0.30))
      m.uniforms.uRed.value = redIn * redOut
      m.uniforms.uAmount.value = amount * settle
      g.visible = amount * settle > 0.004

      const span = w.height * 0.95
      g.position.set(w.x, 0.32, w.z)
      g.scale.set(span, span, 1)
    }
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { meshes.current[i] = m }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </>
  )
}
