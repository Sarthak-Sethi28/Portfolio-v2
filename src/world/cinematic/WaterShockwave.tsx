'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type Mesh, type ShaderMaterial } from 'three'
import { cinematicSample } from './cinematicState'

const PORTAL = [0, -150] as const

/**
 * ONE shockwave, leaving the portal as it reaches full power.
 *
 * Exactly one primary ring with a weaker trailing one, and it is driven by the
 * master clock rather than fired by an event — so scrubbing back to 9.4
 * seconds shows the wave where it was at 9.4 seconds, every time. An
 * event-triggered effect cannot do that: it has no idea it was supposed to
 * have gone off already.
 *
 * NOT a neon ring on the water. Same approach as the local disturbance: build
 * a height field, take its gradient, light it. A bright circle expanding
 * outward reads as a Tron effect pasted over the sea; a moving band of
 * displaced surface catching the light reads as water being shoved. Amplitude
 * falls as the radius grows, because the same energy is being spread around an
 * ever longer circumference.
 */
export function WaterShockwave() {
  const mat = useRef<ShaderMaterial>(null)
  const mesh = useRef<Mesh>(null)
  /*
   * WARM-UP FRAMES.
   *
   * This shader compiles the first time its mesh is actually drawn, and a
   * shader compile is a synchronous stall — measured at up to 179ms in a
   * production build, landing squarely in the beat where the effect first
   * appears. WebGLRenderer.compile() cannot pre-empt it either, because that
   * walks the scene with traverseVisible and skips anything hidden.
   *
   * So the mesh is drawn for a few frames while the page is still settling,
   * with its amount at zero — the fragment shader resolves to nothing, so
   * there is no visual change whatsoever, but the program is built and linked
   * long before the visitor presses anything.
   */
  const warm = useRef(0)


  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
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

        float height(vec2 p, float lead) {
          float r = length(p);
          // Primary crest, and one much weaker ring trailing it.
          float a = band(r, lead, 0.045) * 1.0;
          float b = band(r, lead - 0.085, 0.05) * 0.28;
          // Fine chop riding on the crest, so the front is not a clean arc.
          float detail = sin(r * 210.0 - uTime * 9.0) * 0.12 * band(r, lead, 0.07);
          return a + b + detail;
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float lead = uProgress * 0.95;

          float e = 0.0035;
          float hx = height(p + vec2(e, 0.0), lead) - height(p - vec2(e, 0.0), lead);
          float hy = height(p + vec2(0.0, e), lead) - height(p - vec2(0.0, e), lead);
          // GAIN on the gradient. The height field is in UV units, so its raw
          // slope over a 0.0035 sample is a fraction of a degree and the normal
          // came out essentially flat — the crest computed a specular of almost
          // zero and the wave was invisible against a lit sky. Scaling the
          // gradient is the difference between a surface that is disturbed and
          // one that merely has small numbers in it.
          vec3 n = normalize(vec3(-hx * 26.0, -hy * 26.0, 0.35));

          vec3 lightDir = normalize(vec3(0.35, 0.30, 0.89));
          float spec = pow(max(dot(n, lightDir), 0.0), 7.0);

          /*
           * Rise, then fall. The rise is not optional.
           *
           * With only the falloff term the wave existed at full amplitude on
           * its very first frame, when its crest is still at radius zero — the
           * height field is near-vertical there, the gain drives the normal
           * hard over, and the specular saturated across the entire plane. The
           * ocean went pure white for a frame. Energy leaving a source starts
           * at nothing and builds, so the front now grows in over the first
           * tenth of the wave's life.
           */
          /*
           * GATE ON THE WAVE ITSELF.
           *
           * This was the real cause of the foreground washing out, and it is
           * not obvious: flat water has a normal of (0,0,1), which points
           * almost directly at the light, so the specular came back high across the
           * ENTIRE plane and not just on the crest. The gradient tells you how
           * the surface is tilted; it says nothing about whether there is a
           * wave there at all. Undisturbed water must contribute nothing, so
           * the output is masked by the local amplitude.
           */
          float amp = abs(height(p, lead));
          float present = smoothstep(0.02, 0.22, amp);

          float rise = smoothstep(0.0, 0.11, uProgress);
          float falloff = (1.0 - uProgress) * (1.0 - uProgress);
          // Clamped: additive blending has no natural ceiling, and one bad
          // frame of unbounded highlight is a flash in the viewer's face.
          float a = min(spec * present * rise * falloff * 3.0, 0.8);

          // A trace of the portal's red carried on the front, no more.
          vec3 col = mix(vec3(0.70, 0.78, 0.90), vec3(1.0, 0.32, 0.16), 0.35);
          gl_FragColor = vec4(col * a, a);
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
    if (warm.current < 4) { warm.current++; g.visible = true; return }
    g.visible = p > 0.001 && p < 0.999
  })

  return (
    <mesh ref={mesh} position={[PORTAL[0], 0.3, PORTAL[1]]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <planeGeometry args={[900, 900]} />
      <shaderMaterial ref={mat} args={[shader]} />
    </mesh>
  )
}
