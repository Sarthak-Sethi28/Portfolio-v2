'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type Mesh, type ShaderMaterial } from 'three'
import { cinematicSample } from './cinematicState'

const PORTAL = [0, -150] as const

/**
 * The single environmental discharge.
 *
 * This must NEVER read as a bomb. There is no sphere, no fireball and no
 * full-screen flash. It is a low pressure/energy front skimming across the
 * water after the red circuit reaches full charge. The front is thin enough to
 * read as one travelling event, but irregular and soft enough not to become a
 * perfect Tron ring pasted onto the ocean.
 */
export function WaterShockwave() {
  const mat = useRef<ShaderMaterial>(null)
  const mesh = useRef<Mesh>(null)
  const warm = useRef(0)

  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uProgress: { value: 0 },
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
        uniform float uProgress;
        uniform float uTime;

        float band(float r, float centre, float width) {
          return exp(-pow((r - centre) / width, 2.0));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float angle = atan(p.y, p.x);
          float lead = mix(0.025, 0.96, uProgress);

          // Break the front very slightly so it belongs to moving water rather
          // than to a graphics package. The wobble stays far smaller than the
          // band itself: this is still one coherent pressure front.
          float wobble = sin(angle * 7.0 + uTime * 0.45) * 0.018
                       + sin(angle * 13.0 - uTime * 0.28) * 0.009;

          float front = band(r, lead + wobble, 0.060);
          float after = band(r, lead - 0.105 + wobble * 0.45, 0.135) * 0.20;

          // A faint broken glint inside the front makes the water feel like it
          // is carrying red light, without turning the wave into a solid ring.
          float breakup = 0.58 + 0.42 * sin(r * 74.0 - uTime * 2.2 + angle * 3.0);
          breakup = smoothstep(0.18, 0.92, breakup);

          float rise = smoothstep(0.0, 0.10, uProgress);
          float fall = 1.0 - smoothstep(0.84, 1.0, uProgress);
          float life = rise * fall;

          float redFront = front * (0.38 + breakup * 0.62);
          float amount = (redFront * 0.44 + after * 0.12) * life;

          // Deliberately deep red. Bright pink/white is what made the previous
          // event read as an explosion rather than power travelling through water.
          vec3 col = vec3(1.0, 0.035, 0.012) * amount;
          float alpha = min(amount * 0.78, 0.34);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
    [],
  )

  useFrame((_, delta) => {
    const m = mat.current
    const g = mesh.current
    if (!m || !g) return

    const p = cinematicSample.shockwave
    m.uniforms.uTime.value += delta
    m.uniforms.uProgress.value = p

    // Compile before the visitor ever sees it; this effect arrives on a key beat.
    if (warm.current < 4) {
      warm.current++
      g.visible = true
      return
    }

    g.visible = p > 0.001 && p < 0.999
  })

  return (
    <mesh
      ref={mesh}
      position={[PORTAL[0], 0.34, PORTAL[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      renderOrder={14}
    >
      <planeGeometry args={[900, 900]} />
      <shaderMaterial ref={mat} args={[shader]} />
    </mesh>
  )
}
