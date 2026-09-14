'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type ShaderMaterial } from 'three'
import { cinematicSample } from './cinematicState'

/** Where the portal meets the water. */
const PORTAL = [0, -150] as const

/**
 * Local water disturbance around the portal.
 *
 * The ocean must NOT change speed as a whole. A world-wide change of sea state
 * is the sea doing something; this beat is the portal doing something to the
 * sea, and the difference is entirely whether the effect is local. So this is
 * a patch of surface centred on the portal, and the distant water carries on
 * exactly as it was.
 *
 * It shades like water rather than like a sprite. The shader builds a height
 * field from converging rings plus crossed chop, takes its GRADIENT, and uses
 * that to drive a specular response against a fixed light direction — so what
 * you see is a highlight moving across a disturbed surface, which is what a
 * disturbance actually looks like. Drawing the wave as brightness directly
 * would produce exactly the animated-PNG-on-the-ocean look this has to avoid:
 * glowing where it should be dark, and rotating with nothing.
 *
 * Additive and depth-write off, so it contributes light to the existing water
 * instead of replacing it.
 */
export function WaterDisturbance() {
  const mat = useRef<ShaderMaterial>(null)

  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uPull: { value: 0 },
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
        uniform float uAmount;
        uniform float uPull;

        // Height of the disturbed surface at p, in local units.
        float height(vec2 p) {
          float r = length(p);
          // Rings running INWARD toward the portal: the ocean drawing in.
          float inward = sin(r * 34.0 + uTime * 5.0) * exp(-r * 2.2);
          // Crossed chop, so the patch is agitated rather than merely ringed.
          float chop = sin(p.x * 26.0 - uTime * 2.1) * sin(p.y * 22.0 + uTime * 1.7) * 0.45;
          return inward * (0.45 + uPull * 0.85) + chop * uAmount;
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          // Gradient of the height field -> surface normal -> specular. This is
          // why it reads as water and not as a decal.
          float e = 0.004;
          float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
          float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
          // Same gain as the shockwave, for the same reason: a raw UV-space
          // gradient is far too shallow to light.
          vec3 n = normalize(vec3(-hx * 22.0, -hy * 22.0, 0.3));

          vec3 lightDir = normalize(vec3(0.42, 0.36, 0.83));
          float spec = pow(max(dot(n, lightDir), 0.0), 8.0);

          // Fades to nothing at the rim, so the patch has no edge.
          float edge = 1.0 - smoothstep(0.55, 1.0, r);
          float a = spec * edge * uAmount * 1.8;
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.86) * a, a);
        }
      `,
    }),
    [],
  )

  useFrame((_, delta) => {
    const m = mat.current
    if (!m) return
    m.uniforms.uTime.value += delta
    m.uniforms.uAmount.value = cinematicSample.disturbance
    m.uniforms.uPull.value = cinematicSample.pull
  })

  return (
    <mesh
      position={[PORTAL[0], 0.28, PORTAL[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={cinematicSample.disturbance > 0.001}
    >
      <planeGeometry args={[420, 420]} />
      <shaderMaterial ref={mat} args={[shader]} />
    </mesh>
  )
}
