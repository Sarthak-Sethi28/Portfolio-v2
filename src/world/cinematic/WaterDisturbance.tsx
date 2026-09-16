'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type Mesh, type ShaderMaterial } from 'three'
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
          // Same gate as the shockwave: flat water points its normal at the
          // light and would otherwise be specular everywhere.
          float present = smoothstep(0.015, 0.2, abs(height(p)));
          float edge = 1.0 - smoothstep(0.55, 1.0, r);
          /*
           * Clamped, and gentler.
           *
           * Additive blending has no ceiling, so a specular that saturates
           * simply keeps adding — the patch stopped reading as agitated water
           * and washed the whole foreground to pale grey, which also destroyed
           * the sunset reflection it was sitting on top of. This is meant to
           * be a disturbance ON the ocean, so it must never be brighter than
           * the ocean it disturbs.
           */
          float a = min(spec * present * edge * uAmount * 1.1, 0.4);
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.86) * a, a);
        }
      `,
    }),
    [],
  )

  useFrame((_, delta) => {
    const m = mat.current
    const g = mesh.current
    if (!m || !g) return
    m.uniforms.uTime.value += delta
    m.uniforms.uAmount.value = cinematicSample.disturbance
    m.uniforms.uPull.value = cinematicSample.pull
    /*
     * Visibility belongs in the FRAME LOOP, not in JSX.
     *
     * This was `visible={cinematicSample.disturbance > 0.001}` on the element,
     * which reads the shared mutable sample during render — and this component
     * renders perhaps twice in its life, so the test ran at mount, found zero,
     * and the patch stayed hidden for the entire cinematic. The water-reacts
     * beat has never once been on screen. Anything derived from the clock has
     * to be evaluated on every frame, which is what a frame callback is for.
     */
    if (warm.current < 4) { warm.current++; g.visible = true; return }
    g.visible = cinematicSample.disturbance > 0.001
  })

  return (
    <mesh
      ref={mesh}
      position={[PORTAL[0], 0.28, PORTAL[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[420, 420]} />
      <shaderMaterial ref={mat} args={[shader]} />
    </mesh>
  )
}
