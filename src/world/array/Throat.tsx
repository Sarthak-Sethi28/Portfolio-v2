'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, ShaderMaterial, Color } from 'three'

/**
 * THROUGH THE APERTURE — the tunnel behind the ring.
 *
 * Board 14 is a passage: concentric rings of red light receding away from the
 * camera while it travels down them. None of that could happen, because the
 * portal is a RING — 0.72 units deep against 1.9 wide. Flying through it takes
 * a single frame, and what the camera found on the far side was the same sea
 * it had just left. The moment the whole sequence builds toward was over
 * before it registered.
 *
 * So the throat is a separate object: a long open cylinder seen from the
 * inside, hidden until the approach begins and lit only by its own ribs. It
 * exists purely for the four seconds the camera is inside it, which is why it
 * is drawn with a flat shader rather than a lit material — there is no light
 * in there to speak of, and nothing to catch it.
 *
 * The ribs stream TOWARD the camera. A static pattern in a moving tunnel reads
 * as a painted pipe; ribs that travel give the passage its own velocity on top
 * of the camera's, which is what makes it feel like being pulled through
 * rather than flown down.
 */
export function Throat({
  radius,
  length,
  opacity,
}: {
  radius: number
  length: number
  /** 0 hides it entirely — it must not exist during the arrival. */
  opacity: number
}) {
  const mat = useRef<ShaderMaterial>(null)

  const shader = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new Color('#ff2a12') },
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
        uniform float uOpacity;
        uniform vec3 uColor;

        void main() {
          // Rings along the tunnel's length, travelling toward the mouth.
          float v = vUv.y * 26.0 + uTime * 2.4;
          float rib = smoothstep(0.46, 0.5, abs(fract(v) - 0.5));

          /*
           * Many fine rails, not four fat ones.
           *
           * At four they met at the vanishing point and drew an enormous X
           * across the middle of the frame — the most conspicuous thing in the
           * shot, and pure geometry rather than architecture. Twenty-four thin
           * ones read as fluting on the inside of a pipe, which is what gives
           * the passage its orientation without becoming the subject.
           */
          float rail = smoothstep(0.9955, 1.0, abs(sin(vUv.x * 75.4))) * 0.35;

          // Darker toward the far end, so it reads as depth and not as a
          // cylinder of uniform paint.
          float depth = smoothstep(0.0, 0.55, vUv.y);

          float m = max(rib, rail) * depth;

          /*
           * The walls must OCCLUDE.
           *
           * At 0.12 base alpha the tunnel was a hologram: the moon and the sea
           * showed straight through it, so the camera never felt enclosed and
           * the passage read as rings painted on the air. A tunnel you can see
           * the outside world through is not a tunnel. The body is opaque and
           * nearly black, and only the ribs carry light — which is also how
           * the far end goes properly dark instead of fading into the sky.
           */
          vec3 col = uColor * (0.06 + m * 3.0);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    }),
    [],
  )

  useFrame((_, delta) => {
    const m = mat.current
    if (!m) return
    m.uniforms.uTime.value += delta
    m.uniforms.uOpacity.value = opacity
  })

  // Laid along Z, open at both ends, seen from inside.
  return (
    <mesh position={[0, 0, -length / 2]} rotation={[Math.PI / 2, 0, 0]} visible={opacity > 0.001}>
      <cylinderGeometry args={[radius, radius * 0.78, length, 48, 1, true]} />
      <shaderMaterial
        ref={mat}
        args={[shader]}
        side={BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}
