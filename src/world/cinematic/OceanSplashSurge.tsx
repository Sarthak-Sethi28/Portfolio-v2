'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  PointsMaterial,
  ShaderMaterial,
  type Mesh,
  type Points,
} from 'three'
import { cinematicClock, cinematicSample } from './cinematicState'

const PORTAL_X = 0
const PORTAL_Z = -150
const SPRAY_COUNT = 360

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  return smooth01((t - a) / (b - a))
}

function rand(i: number, salt: number): number {
  const n = Math.sin((i + 1) * (12.9898 + salt * 17.17)) * 43758.5453123
  return n - Math.floor(n)
}

/**
 * The water event is a SURFACE event, not a wormhole hovering over the sea.
 *
 * This component deliberately renders only the moving crest/foam/spray. It does
 * not paint a dark circular disc over the ocean. The base Water remains the
 * visible surface; this geometry rises directly out of it and the droplets are
 * ballistic in world space, which makes the read "water is breaking" rather
 * than "a portal has appeared above the water".
 */
export function OceanSplashSurge() {
  const surge = useRef<Mesh>(null)
  const surgeMat = useRef<ShaderMaterial>(null)
  const spray = useRef<Points>(null)
  const sprayMat = useRef<PointsMaterial>(null)

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
        uFront: { value: 0 },
        uRed: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vCrest;
        varying float vFoam;
        varying float vHeight;
        uniform float uTime;
        uniform float uAmount;
        uniform float uChaos;
        uniform float uFront;

        float gauss(float x, float w) {
          return exp(-pow(x / w, 2.0));
        }

        void main() {
          vUv = uv;
          vec2 p = uv * 2.0 - 1.0;

          // The front travels from the portal toward camera as ONE broad wall.
          // It is not radial, so it cannot read as another circular gateway.
          float front = mix(0.72, -0.66, uFront);
          float lateral = 1.0 - smoothstep(0.58, 1.0, abs(p.x));
          float wobble = sin(p.x * 7.0 + uTime * 0.62) * 0.055
                       + sin(p.x * 15.0 - uTime * 0.31) * 0.024;
          float crest = gauss(p.y - front - wobble, 0.105 + uChaos * 0.028) * lateral;
          float shoulder = gauss(p.y - front - 0.16 - wobble * 0.35, 0.19) * lateral * 0.34;

          // Large, ugly water motion behind the crest. No perfect sine field;
          // crossed frequencies keep the top line broken and inconsistent.
          float chop = sin(p.x * 15.0 + uTime * 1.8)
                     * sin(p.y * 18.0 - uTime * 1.27);
          float chop2 = sin(p.x * 27.0 - p.y * 9.0 + uTime * 0.73);
          float wake = gauss(p.y - front - 0.28, 0.34) * lateral;

          float height = uAmount * (
            crest * (3.5 + 12.5 * uChaos)
            + shoulder * (1.8 + 5.5 * uChaos)
            + wake * (chop * 1.35 + chop2 * 0.75) * uChaos
          );

          vec3 pos = position;
          // This mesh is rotated -90deg around X, so +local Z is +world Y.
          pos.z += max(-0.4, height);

          vCrest = crest;
          vFoam = max(0.0, crest * (0.62 + 0.38 * sin(p.x * 41.0 + uTime * 2.2))
                    + shoulder * 0.25);
          vHeight = height;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vCrest;
        varying float vFoam;
        varying float vHeight;
        uniform float uTime;
        uniform float uAmount;
        uniform float uChaos;
        uniform float uRed;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float edge = 1.0 - smoothstep(0.70, 1.0, max(abs(p.x), abs(p.y)));

          // Patchy whitewater. The gaps are essential: a continuous bright band
          // would again look like a graphics ring instead of broken water.
          float foamNoise = 0.5 + 0.5 * sin(p.x * 63.0 + p.y * 37.0 - uTime * 3.0);
          foamNoise *= 0.58 + 0.42 * sin(p.x * 29.0 - p.y * 51.0 + uTime * 1.4);
          float foam = vFoam * smoothstep(0.18, 0.82, foamNoise) * uChaos;

          vec3 deep = vec3(0.025, 0.070, 0.095);
          vec3 water = vec3(0.075, 0.18, 0.23);
          vec3 whitewater = vec3(0.70, 0.84, 0.87);
          vec3 redCatch = vec3(0.52, 0.018, 0.010);

          float lit = clamp(vCrest * 0.56 + abs(vHeight) * 0.018, 0.0, 1.0);
          vec3 colour = mix(deep, water, lit);
          colour = mix(colour, whitewater, min(1.0, foam * 1.35));
          // Red arrives ON already-moving water, never as a separate red disc.
          colour = mix(colour, redCatch, uRed * (0.12 + vCrest * 0.48));

          float alpha = edge * uAmount * (
            vCrest * (0.20 + uChaos * 0.34)
            + foam * 0.68
            + min(abs(vHeight) * 0.012, 0.12)
          );

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(colour, min(alpha, 0.78));
        }
      `,
    }),
    [],
  )

  const { sprayGeometry, seeds } = useMemo(() => {
    const positions = new Float32Array(SPRAY_COUNT * 3)
    positions.fill(-999)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))

    const data = Array.from({ length: SPRAY_COUNT }, (_, i) => ({
      x: (rand(i, 1) * 2 - 1) * 142,
      jitterZ: (rand(i, 2) * 2 - 1) * 14,
      spawn: 1.05 + rand(i, 3) * 6.75,
      life: 0.72 + rand(i, 4) * 1.05,
      vx: (rand(i, 5) * 2 - 1) * (3.5 + rand(i, 6) * 7.5),
      vz: 4.0 + rand(i, 7) * 18.0,
      vy: 7.0 + rand(i, 8) * 18.0,
      sizeBias: rand(i, 9),
    }))

    return { sprayGeometry: geometry, seeds: data }
  }, [])

  useFrame((_, delta) => {
    const t = cinematicClock.elapsed
    const amount = span(t, 0.72, 1.95) * (1 - span(t, 8.75, 11.25))
    const chaos = span(t, 1.35, 4.85) * (1 - span(t, 8.10, 10.60) * 0.30)
    const front = span(t, 0.95, 7.75)
    const red = Math.max(span(t, 5.15, 7.55), cinematicSample.power * 0.85)

    const m = surgeMat.current
    if (m) {
      m.uniforms.uTime.value += delta
      m.uniforms.uAmount.value = amount
      m.uniforms.uChaos.value = chaos
      m.uniforms.uFront.value = front
      m.uniforms.uRed.value = red
    }
    if (surge.current) surge.current.visible = amount > 0.002

    const attr = sprayGeometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    let visible = 0

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const age = t - s.spawn
      const k = i * 3
      if (age < 0 || age > s.life || amount < 0.01) {
        arr[k] = 0
        arr[k + 1] = -999
        arr[k + 2] = 0
        continue
      }

      // Where the travelling wall was when this droplet was torn free.
      const bornProgress = span(s.spawn, 0.95, 7.75)
      const frontZ = PORTAL_Z + bornProgress * 218

      arr[k] = PORTAL_X + s.x + s.vx * age
      arr[k + 1] = 0.25 + s.vy * age - 8.6 * age * age
      arr[k + 2] = frontZ + s.jitterZ + s.vz * age
      visible++
    }
    attr.needsUpdate = true

    if (spray.current) spray.current.visible = visible > 0
    if (sprayMat.current) {
      // Spray starts cold/white and catches red only after the machine charges.
      sprayMat.current.color.setRGB(
        0.72 + red * 0.24,
        0.86 - red * 0.63,
        0.90 - red * 0.73,
      )
      sprayMat.current.opacity = Math.min(0.68, 0.22 + chaos * 0.42)
      sprayMat.current.size = 1.9 + chaos * 2.3
    }
  })

  return (
    <>
      <mesh
        ref={surge}
        position={[0, 0.035, -65]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        renderOrder={13}
      >
        <planeGeometry args={[360, 320, 128, 112]} />
        <shaderMaterial ref={surgeMat} args={[shader]} />
      </mesh>

      <points ref={spray} geometry={sprayGeometry} frustumCulled={false} visible={false} renderOrder={16}>
        <pointsMaterial
          ref={sprayMat}
          color="#b8d9e0"
          size={2.2}
          sizeAttenuation
          transparent
          opacity={0.4}
          depthWrite={false}
          depthTest
        />
      </points>
    </>
  )
}
