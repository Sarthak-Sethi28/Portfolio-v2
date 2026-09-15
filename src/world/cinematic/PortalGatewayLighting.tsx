'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  DoubleSide,
  type Mesh,
  type PointLight,
  type ShaderMaterial,
} from 'three'
import { cinematicSample, portalFrame } from './cinematicState'

/**
 * The portal has to LIGHT the world, not merely paint itself red.
 *
 * The GLB's emissive channel makes the ring visible, but emissive materials do
 * not cast light into the water or onto neighbouring metal. These lights are
 * mounted from the first frame at zero intensity so the shader/light-count
 * variant is compiled before the cinematic starts, then they rise with the
 * same charge that drives the portal.
 *
 * The floor patch is not a laser runway. It is a broken, elongated reflection
 * under the gateway: narrow highlights stretched toward camera by a wet surface.
 */
export function PortalGatewayLighting() {
  const key = useRef<PointLight>(null)
  const left = useRef<PointLight>(null)
  const right = useRef<PointLight>(null)
  const reflection = useRef<Mesh>(null)
  const reflectionMat = useRef<ShaderMaterial>(null)

  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: {
        uAmount: { value: 0 },
        uTime: { value: 0 },
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
        uniform float uAmount;
        uniform float uTime;

        float g(float x, float c, float w) {
          return exp(-pow((x - c) / w, 2.0));
        }

        void main() {
          // x is across the reflection.  d is distance FROM the portal toward
          // camera: rotation of the plane puts v=1 at the portal end.
          float x = (vUv.x - 0.5) * 2.0;
          float d = 1.0 - vUv.y;

          // Strong close to the source, then carried a long way down wet water.
          float depthFade = exp(-d * 1.55) * (1.0 - smoothstep(0.88, 1.0, d));
          float crossFade = exp(-x * x * 2.4);

          // Broken vertical streaks rather than geometric lines. The two sine
          // fields are intentionally slow; this is reflected light on moving
          // water, not an animated HUD.
          float breakupA = 0.5 + 0.5 * sin(d * 72.0 + sin(x * 11.0) * 2.2 + uTime * 0.38);
          float breakupB = 0.5 + 0.5 * sin(d * 39.0 - x * 17.0 - uTime * 0.21);
          float broken = pow(max(0.0, breakupA * 0.72 + breakupB * 0.28), 4.0);

          float core = g(x, 0.0, 0.10) * (0.32 + broken * 0.68);
          float leftStreak = g(x, -0.24, 0.055) * (0.18 + broken * 0.82);
          float rightStreak = g(x, 0.22, 0.050) * (0.24 + broken * 0.76);
          float wide = g(x, 0.02, 0.34) * 0.10;

          float intensity = (core * 0.78 + leftStreak * 0.42 + rightStreak * 0.38 + wide)
            * depthFade * crossFade * uAmount;

          // Keep it red rather than pink/white. ACES can desaturate very bright
          // emissive values, so the effect stays in a restrained range.
          vec3 col = vec3(1.0, 0.055, 0.018) * intensity;
          gl_FragColor = vec4(col, min(intensity * 0.82, 0.46));
        }
      `,
    }),
    [],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const s = cinematicSample
    const c = portalFrame.centre

    // The world begins to catch red while the circuit is travelling, then the
    // gateway becomes a real light source only when full power is reached.
    const charge = Math.min(1, Math.max(s.ignition * 0.38, s.power))

    if (portalFrame.measured) {
      if (key.current) key.current.position.set(c.x, c.y - 5, c.z + 12)
      if (left.current) left.current.position.set(c.x - portalFrame.radius * 0.48, c.y - 10, c.z + 8)
      if (right.current) right.current.position.set(c.x + portalFrame.radius * 0.48, c.y - 10, c.z + 8)
      if (reflection.current) reflection.current.position.set(c.x, 0.34, c.z + 105)
    }

    // Large values are normal for physically-correct point lights at this world
    // scale. The front source does the read; the side pair only shape the gold
    // and water so the ring does not become a flat neon decal.
    if (key.current) key.current.intensity = charge * 5200
    if (left.current) left.current.intensity = charge * 2100
    if (right.current) right.current.intensity = charge * 2100

    const m = reflectionMat.current
    if (m) {
      m.uniforms.uTime.value += delta
      m.uniforms.uAmount.value = charge
    }
    if (reflection.current) reflection.current.visible = charge > 0.002
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <pointLight ref={key} color="#ff2412" intensity={0} distance={240} decay={2} castShadow={false} />
      <pointLight ref={left} color="#d91208" intensity={0} distance={175} decay={2} castShadow={false} />
      <pointLight ref={right} color="#d91208" intensity={0} distance={175} decay={2} castShadow={false} />

      <mesh ref={reflection} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={15}>
        <planeGeometry args={[150, 280]} />
        <shaderMaterial ref={reflectionMat} args={[shader]} />
      </mesh>
    </>
  )
}
