'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  type Points as ThreePoints,
} from 'three'
import { cinematicClock } from './cinematicState'

const PORTAL_X = 0
const PORTAL_Z = -150

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

/**
 * SPRAY.
 *
 * This component used to own a second 620-unit translucent surface that sat
 * 0.18 above the sea and carried its own displacement, foam and colour. That
 * was the white blanket: because its alpha rose with displacement across the
 * whole patch, any agitation painted a broad pale membrane over the blue, and
 * because it was a separate plane it could never be anything but a layer.
 *
 * The real Water mesh now carries all of that — displacement AND foam — on its
 * own vertices. What is left here is the part that genuinely cannot live on the
 * surface: airborne droplets thrown off the steep water, launched ballistically
 * and short-lived.
 */
export function OceanChaos() {
  const spray = useRef<ThreePoints>(null)
  const warm = useRef(0)

  const sprayBuilt = useMemo(() => {
    const count = 320
    let state = 0x71ab39d1 >>> 0
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }

    const seeds = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const o = i * 4
      seeds[o] = rand() * Math.PI * 2
      seeds[o + 1] = 24 + rand() * 62
      seeds[o + 2] = rand()
      seeds[o + 3] = rand()
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4))

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uRed: { value: 0 },
      },
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uAmount;
        varying float vLife;
        varying float vRed;

        void main() {
          float angle = aSeed.x;
          float radius = aSeed.y;
          float phase = aSeed.z;
          float character = aSeed.w;

          float cycle = fract(phase + uTime * (0.20 + character * 0.12));
          float alive = smoothstep(0.02, 0.12, cycle) * (1.0 - smoothstep(0.70, 0.98, cycle));

          // Ballistic splash: launch, rise, fall. Not suspended glitter.
          float launch = radius + cycle * (8.0 + 22.0 * character);
          vec3 pos = vec3(
            cos(angle) * launch,
            0.8 + sin(cycle * 3.14159265) * (7.0 + 18.0 * character) - cycle * cycle * 5.0,
            sin(angle) * launch
          );
          pos.z += cycle * (10.0 + character * 18.0);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.1 + character * 2.5) * alive * uAmount * (92.0 / max(18.0, -mv.z));

          vLife = alive * uAmount;
          vRed = character;
        }
      `,
      fragmentShader: `
        uniform float uRed;
        varying float vLife;
        varying float vRed;

        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float rr = dot(q, q);
          if (rr > 1.0) discard;

          float soft = (1.0 - smoothstep(0.18, 1.0, rr)) * vLife;
          vec3 cold = vec3(0.78, 0.88, 0.94);
          vec3 hot = vec3(0.95, 0.10, 0.035);
          vec3 colour = mix(cold, hot, clamp(uRed * (0.28 + vRed * 0.72), 0.0, 0.72));

          gl_FragColor = vec4(colour, soft * 0.78);
        }
      `,
    })

    return { geometry, material }
  }, [])

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const t = cinematicClock.elapsed

    // One uninterrupted escalation. The pull is readable by ~3s; the large
    // surge is born later, while that pull/spray is still active.
    const chaos = span(t, 0.9, 3.9) * (1 - span(t, 9.1, 11.3) * 0.70)
    const red = span(t, 5.55, 7.55)

    sprayBuilt.material.uniforms.uTime.value += delta
    sprayBuilt.material.uniforms.uAmount.value =
      chaos * span(t, 2.35, 3.65) * (1 - span(t, 8.6, 10.5) * 0.62)
    sprayBuilt.material.uniforms.uRed.value = red

    const p = spray.current
    if (!p) return

    if (warm.current < 4) {
      warm.current++
      p.visible = true
      return
    }

    p.visible = sprayBuilt.material.uniforms.uAmount.value > 0.01
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <points
        ref={spray}
        position={[PORTAL_X, 0, PORTAL_Z]}
        geometry={sprayBuilt.geometry}
        material={sprayBuilt.material}
        visible={false}
        frustumCulled={false}
        renderOrder={14}
      />
    </>
  )
}
