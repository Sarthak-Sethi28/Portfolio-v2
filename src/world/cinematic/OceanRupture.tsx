'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Mesh, type ShaderMaterial } from 'three'
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
 * The ocean does not play a sequence of separate effects. It becomes unstable
 * once, grows into a violent inward draw, throws up one broad tsunami-like
 * pressure wall, catches the portal's red charge, and only then releases back
 * into the gateway shot.
 *
 * The centre is visually darkened rather than literally cutting a hole in the
 * base water mesh. That keeps this local and non-destructive while still
 * reading from the low camera as a cavity opening in the surface.
 */
export function OceanRupture() {
  const mesh = useRef<Mesh>(null)
  const mat = useRef<ShaderMaterial>(null)
  const warm = useRef(0)

  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uChaos: { value: 0 },
        uRed: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vWall;
        varying float vHeight;
        uniform float uTime;
        uniform float uAmount;
        uniform float uChaos;

        float band(float r, float c, float w) {
          return exp(-pow((r - c) / w, 2.0));
        }

        void main() {
          vUv = uv;
          vec2 p = uv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);

          // The pressure wall begins close to the cavity, then travels outward
          // while continuing to grow. It is broad on purpose: one huge body of
          // water moving, not a clean graphics ring.
          float centre = mix(0.16, 0.54, uChaos);
          float wobble = sin(a * 5.0 + uTime * 0.58) * 0.025
                       + sin(a * 11.0 - uTime * 0.31) * 0.013;
          float wall = band(r, centre + wobble, 0.105 + uChaos * 0.025);

          // Crossed long-wave chop. Amplitude grows with the same continuous
          // event instead of turning on as a separate beat.
          float chop = sin(p.x * 16.0 + uTime * 1.55)
                     * sin(p.y * 13.0 - uTime * 1.20);
          float radial = sin(r * 31.0 - uTime * 2.35 + sin(a * 4.0));
          float edge = 1.0 - smoothstep(0.72, 1.0, r);

          float height = uAmount * edge * (
            wall * (7.0 + 8.0 * uChaos)
            + chop * (0.55 + 1.45 * uChaos)
            + radial * (0.35 + 0.85 * uChaos)
          );

          vec3 pos = position;
          pos.z += height;
          vWall = wall;
          vHeight = height;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vWall;
        varying float vHeight;
        uniform float uTime;
        uniform float uAmount;
        uniform float uChaos;
        uniform float uRed;

        float band(float r, float c, float w) {
          return exp(-pow((r - c) / w, 2.0));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float edge = 1.0 - smoothstep(0.68, 1.0, r);
          float hole = exp(-r * r / mix(0.055, 0.13, uChaos));
          float throat = band(r, mix(0.13, 0.22, uChaos), 0.08 + uChaos * 0.035);

          // Irregular whitewater only on the moving wall. It never becomes a
          // perfect foam circle.
          float breakup = 0.5 + 0.5 * sin(r * 89.0 - uTime * 3.1 + sin(p.x * 17.0) * 2.0);
          breakup *= 0.62 + 0.38 * sin(p.y * 29.0 + uTime * 1.4);
          float foam = vWall * smoothstep(0.36, 0.78, breakup) * uChaos;

          vec3 abyss = vec3(0.0015, 0.004, 0.007);
          vec3 deepWater = vec3(0.018, 0.040, 0.055);
          vec3 redWater = vec3(0.33, 0.006, 0.004);
          vec3 foamCol = mix(vec3(0.36, 0.48, 0.58), vec3(0.82, 0.26, 0.17), uRed * 0.7);

          vec3 colour = mix(deepWater, abyss, clamp(hole * 1.35 + throat * 0.30, 0.0, 1.0));
          colour = mix(colour, redWater, uRed * (0.14 + vWall * 0.46));
          colour = mix(colour, foamCol, foam * 0.62);

          // The cavity is the darkest part; the wall is the most opaque. At the
          // outer rim this goes to zero so the patch has no visible rectangle.
          float alpha = edge * uAmount * (
            hole * 0.82
            + throat * 0.20
            + vWall * 0.48
            + foam * 0.26
            + min(abs(vHeight) * 0.018, 0.12)
          );
          alpha = min(alpha, 0.86);
          gl_FragColor = vec4(colour, alpha);
        }
      `,
    }),
    [],
  )

  useFrame((_, delta) => {
    const m = mat.current
    const g = mesh.current
    if (!m || !g) return

    const t = cinematicClock.elapsed

    // ONE continuous event. The ocean never returns to a neutral pose between
    // these phases; the red charge begins while the water is still at its most
    // violent, and the camera is already advancing by the time it recedes.
    const rise = span(t, 0.65, 2.15)
    const release = 1 - span(t, 8.35, 11.20)
    const amount = rise * release
    const chaos = span(t, 1.35, 5.45) * (1 - span(t, 8.30, 10.80) * 0.38)
    const red = span(t, 5.35, 7.75)

    m.uniforms.uTime.value += delta
    m.uniforms.uAmount.value = amount
    m.uniforms.uChaos.value = chaos
    m.uniforms.uRed.value = red

    // Warm the shader before the cinematic reaches it.
    if (warm.current < 4) {
      warm.current++
      g.visible = true
      return
    }
    g.visible = amount > 0.001
  })

  return (
    <mesh
      ref={mesh}
      position={[PORTAL_X, 0.37, PORTAL_Z]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      renderOrder={13}
    >
      <planeGeometry args={[520, 520, 96, 96]} />
      <shaderMaterial ref={mat} args={[shader]} />
    </mesh>
  )
}
