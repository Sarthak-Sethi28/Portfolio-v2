'use client'

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import type { PerspectiveCamera } from 'three'
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
 * The camera does not enter a second portal. It enters the real Blender bore,
 * and speed turns the SAME red gateway into smeared light around the lens.
 *
 * Colour stays in one family: black -> oxblood -> crimson -> scarlet -> a few
 * ember-hot highlights. No rainbow tunnel, no blue hyperspace, no new circle.
 */
export function PortalTransitionOverlay() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  const overlay = useMemo(() => {
    const material = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uWarp: { value: 0 },
        uBlack: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uWarp;
        uniform float uBlack;
        uniform float uTime;

        float hash(float n) {
          return fract(sin(n) * 43758.5453123);
        }

        float beam(float a, float centre, float width) {
          float d = abs(atan(sin(a - centre), cos(a - centre)));
          return exp(-pow(d / width, 2.0));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          // Keep the radial field visually circular on widescreen without an
          // explicit ring. The slight x stretch is intentionally cinematic.
          p.x *= 1.18;
          float r = length(p);
          float a = atan(p.y, p.x);

          // The centre remains dark: we are looking INTO somewhere, not at a
          // glowing disc pasted over the opening.
          float centreVoid = 1.0 - smoothstep(0.08, 0.36, r);
          float edgeGate = smoothstep(0.16, 0.42, r);

          // Directional light dragged by forward speed. Irregular beam angles
          // stop this becoming a symmetric starburst.
          float b = 0.0;
          b += beam(a, -2.72, 0.020) * 0.70;
          b += beam(a, -2.13, 0.013) * 0.92;
          b += beam(a, -1.36, 0.024) * 0.52;
          b += beam(a, -0.62, 0.011) * 1.00;
          b += beam(a,  0.18, 0.018) * 0.58;
          b += beam(a,  0.87, 0.012) * 0.82;
          b += beam(a,  1.62, 0.021) * 0.46;
          b += beam(a,  2.38, 0.014) * 0.76;

          // Longitudinal segmentation moving rapidly toward the viewer. It
          // turns each beam into fragments of stretched light rather than a
          // static spoke.
          float travel = fract(r * 4.3 - uTime * (1.25 + uWarp * 4.8));
          float streak = pow(smoothstep(0.02, 0.48, travel) * (1.0 - smoothstep(0.72, 0.98, travel)), 0.72);

          // Fine moving breakup gives the sense that physical detail is being
          // pulled into light as the lens accelerates through the machinery.
          float grain = 0.62 + 0.38 * sin(a * 23.0 + r * 51.0 - uTime * 5.7);
          float intensity = b * streak * max(0.0, grain) * edgeGate * uWarp;

          // A broad red smear lives at the extreme edges once speed is high.
          float edgeSmear = smoothstep(0.52, 1.18, r) * uWarp * (0.16 + 0.22 * sin(a * 5.0 + uTime));
          intensity += max(0.0, edgeSmear);

          // Red family only. The hottest fragments may approach ember-orange,
          // but the gateway remains unmistakably red.
          vec3 oxblood = vec3(0.12, 0.001, 0.003);
          vec3 crimson = vec3(0.82, 0.006, 0.008);
          vec3 scarlet = vec3(1.0, 0.035, 0.012);
          vec3 ember = vec3(1.0, 0.17, 0.035);

          float hot = smoothstep(0.42, 0.88, intensity);
          vec3 red = mix(oxblood, crimson, min(1.0, intensity * 1.9));
          red = mix(red, scarlet, smoothstep(0.18, 0.56, intensity));
          red = mix(red, ember, hot * 0.18);

          // As the physical bore disappears behind us, black takes over while
          // a few moving red remnants remain. centreVoid pushes the middle
          // darker sooner, preserving depth throughout the transition.
          float localBlack = uBlack * (0.82 + centreVoid * 0.18);
          float redAlpha = min(0.82, intensity * 0.72);
          float alpha = max(localBlack, redAlpha);
          vec3 colour = red * (1.0 - localBlack * 0.36);

          gl_FragColor = vec4(colour, alpha);
        }
      `,
    })

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    mesh.frustumCulled = false
    mesh.renderOrder = 10001
    mesh.position.set(0, 0, -0.32)
    return mesh
  }, [])

  useEffect(() => {
    camera.add(overlay)
    return () => {
      camera.remove(overlay)
      overlay.geometry.dispose()
      ;(overlay.material as ShaderMaterial).dispose()
    }
  }, [camera, overlay])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const m = overlay.material as ShaderMaterial
    const t = cinematicClock.elapsed

    // The red-speed layer begins BEFORE the front face crosses the lens, so the
    // approach, threshold and bore read as one action. It strengthens while the
    // real geometry is still visible beneath it rather than replacing it in a cut.
    const warpIn = span(t, 12.42, 13.30)
    const warpOut = 1 - span(t, 14.32, 14.82)
    const warp = warpIn * warpOut

    // Darkness grows naturally after the machinery has rushed past. The hidden
    // handback sits inside the peak, then Projects emerges from the same motion.
    const blackIn = span(t, 13.72, 14.34)
    const blackOut = 1 - span(t, 14.56, 15.0)
    const black = blackIn * blackOut

    m.uniforms.uTime.value = t
    m.uniforms.uWarp.value = warp
    m.uniforms.uBlack.value = black
    overlay.visible = warp > 0.001 || black > 0.001
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
