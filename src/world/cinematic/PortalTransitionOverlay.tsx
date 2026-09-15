'use client'

import { useEffect, useMemo, useRef } from 'react'
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
 * Frame 15 — not a plain fade to black.
 *
 * Once the real Blender bore has rushed past the lens, the machinery is gone
 * but its light is still travelling with us for a fraction of a second. This
 * full-screen plane is therefore intentionally abstract: almost pure black,
 * with a handful of thin red streaks that live at the edges and converge into
 * darkness. There is no circle, no second portal, no vortex and no explosion.
 */
export function PortalTransitionOverlay() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const mat = useRef<ShaderMaterial>(null)

  const overlay = useMemo(() => {
    const material = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uBlack: { value: 0 },
        uStreaks: { value: 0 },
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
        uniform float uBlack;
        uniform float uStreaks;
        uniform float uTime;

        float line(float y, float centre, float width) {
          return exp(-pow((y - centre) / width, 2.0));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float ax = abs(p.x);

          // Nothing bright lives in the middle. The streaks are remnants of
          // machinery that just passed the lens, so they enter from the edges
          // and die before reaching centre.
          float edge = smoothstep(0.18, 0.96, ax);
          float taper = smoothstep(0.0, 0.28, ax) * (1.0 - smoothstep(0.96, 1.0, ax));

          // Very small motion: enough to carry forward momentum, never enough
          // to become a hyperspace effect.
          float drift = (uTime - 13.8) * 0.035;
          float bend = (1.0 - ax) * 0.12;

          float s = 0.0;
          s += line(p.y, -0.46 + bend + drift, 0.012) * 0.78;
          s += line(p.y, -0.20 + bend * 0.55 - drift * 0.4, 0.010) * 1.00;
          s += line(p.y,  0.08 - bend * 0.35 + drift * 0.2, 0.009) * 0.56;
          s += line(p.y,  0.31 - bend * 0.75 - drift * 0.3, 0.012) * 0.88;
          s += line(p.y,  0.53 - bend + drift * 0.25, 0.008) * 0.43;

          // Break the lines so there are light fragments rather than perfect
          // rulers drawn across the screen.
          float broken = 0.72 + 0.28 * sin(p.x * 31.0 + p.y * 19.0 + uTime * 1.7);
          s *= max(0.0, broken) * edge * taper * uStreaks;

          vec3 red = vec3(1.0, 0.025, 0.008) * min(s, 0.95);
          vec3 colour = red;

          // A black plate, with the red carried inside the same render so the
          // streaks survive even when the scene underneath is fully obscured.
          float alpha = max(uBlack, min(0.9, s * 0.72));
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
    const m = mat.current ?? (overlay.material as ShaderMaterial)
    const t = cinematicClock.elapsed

    // Machinery is still physically visible until roughly 13.75. Then the
    // abstract between-worlds beat takes over, holds through the hidden camera
    // handback, and dissolves into the Projects world by 15.0.
    const blackIn = span(t, 13.72, 13.96)
    const blackOut = 1 - span(t, 14.52, 15.0)
    const black = blackIn * blackOut

    const streakIn = span(t, 13.78, 13.98)
    const streakOut = 1 - span(t, 14.26, 14.62)
    const streaks = streakIn * streakOut

    m.uniforms.uTime.value = t
    m.uniforms.uBlack.value = black
    m.uniforms.uStreaks.value = streaks
    overlay.visible = black > 0.001 || streaks > 0.001
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
