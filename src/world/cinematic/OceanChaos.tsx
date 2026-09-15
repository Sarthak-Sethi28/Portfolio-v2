'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  ShaderMaterial,
  type Mesh,
  type Points as ThreePoints,
} from 'three'
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
 * THE PULL.
 *
 * Reference lock: storyboard Frame 04.
 *
 * This is not a graphic on top of the ocean. The local surface is genuinely
 * displaced in the vertex shader: the centre draws down, broken ridges are
 * advected inward, and only later does a broad asymmetric surge travel toward
 * camera. A separate GPU spray field throws droplets off the steep water.
 *
 * There is deliberately no clean circular dome, black disc, annulus or
 * membrane. Nothing radial is allowed to stay geometrically perfect.
 */
export function OceanChaos() {
  const surface = useRef<Mesh>(null)
  const spray = useRef<ThreePoints>(null)
  const warm = useRef(0)

  const surfaceMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uChaos: { value: 0 },
          uPull: { value: 0 },
          uSurge: { value: 0 },
          uRed: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vHeight;
          varying float vWall;
          varying float vNearGate;

          uniform float uTime;
          uniform float uChaos;
          uniform float uPull;
          uniform float uSurge;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          float ridge(vec2 p) {
            return 1.0 - abs(noise(p) * 2.0 - 1.0);
          }

          float signedChop(vec2 p, float t) {
            float h = 0.0;
            h += ridge(p * 2.6 + vec2(t * 0.30, -t * 0.23)) * 0.46;
            h += ridge(p * 5.7 - vec2(t * 0.53,  t * 0.39)) * 0.28;
            h += ridge(p * 12.8 + vec2(-t * 0.87, t * 0.71)) * 0.17;
            h += ridge(p * 26.0 + vec2(t * 1.37, t * 1.05)) * 0.09;
            return (h - 0.57) * 2.0;
          }

          vec2 rotate2(vec2 p, float a) {
            float c = cos(a);
            float s = sin(a);
            return mat2(c, -s, s, c) * p;
          }

          void main() {
            vUv = uv;
            vec2 p = uv * 2.0 - 1.0;
            float r = length(p);
            float ang = atan(p.y, p.x);

            float nearGate = 1.0 - smoothstep(0.05, 0.62, r);
            vNearGate = nearGate;

            vec2 dir = r > 0.0001 ? p / r : vec2(0.0);

            // The surface is pulled inward AND slightly around the throat.
            // Angular noise stops the flow becoming a perfect whirlpool.
            float swirlNoise = (noise(vec2(ang * 2.2, uTime * 0.12)) - 0.5) * 0.55;
            vec2 drawn = rotate2(p, (0.46 + swirlNoise) * uPull * nearGate);
            drawn -= dir * uPull * nearGate * (0.20 + noise(p * 4.0) * 0.10);

            float base = signedChop(drawn * 1.45, uTime) * uChaos;
            float broken = base * (0.55 + nearGate * 3.9);

            // A real draw-down: irregular and shallow enough to stay water,
            // not a black hole. The broken ridges/spray carry the violence.
            float throatShape = exp(-r * r / 0.055);
            float throatNoise = 0.68 + noise(vec2(ang * 3.4, uTime * 0.20)) * 0.55;
            float sink = -uPull * throatShape * throatNoise * 6.0;

            // The tsunami-like beat comes AFTER the pull. It is a broad curved
            // front moving toward camera, not a radial ring.
            float crooked = (noise(vec2(p.x * 3.1, uTime * 0.17)) - 0.5) * 0.13;
            float front = mix(-0.34, 0.76, uSurge) + p.x * p.x * 0.18 + crooked;
            float wall = exp(-pow((p.y - front) / 0.115, 2.0));
            float wallLife = smoothstep(0.02, 0.16, uSurge) * (1.0 - smoothstep(0.78, 1.0, uSurge));
            float surge = wall * wallLife * (6.5 + uChaos * 5.5);
            vWall = wall * wallLife;

            float height = broken * (1.5 + nearGate * 3.5) + sink + surge;

            vec3 pos = position;
            // Plane local +Z becomes world +Y after the mesh rotation.
            pos.z += height;

            vHeight = height;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying float vHeight;
          varying float vWall;
          varying float vNearGate;

          uniform float uTime;
          uniform float uChaos;
          uniform float uPull;
          uniform float uRed;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            if (r > 1.0) discard;

            // Broken whitewater: concentrated on displaced crests and the
            // travelling wall. No concentric foam bands.
            float grain = noise(p * 33.0 + vec2(uTime * 0.44, -uTime * 0.31));
            float crest = smoothstep(1.4, 5.4, vHeight) * smoothstep(0.36, 0.78, grain);
            float tear = vWall * smoothstep(0.30, 0.72, noise(p * 48.0 - uTime * 0.7));
            float foam = clamp(crest * 0.78 + tear * 0.62, 0.0, 1.0);

            // Thin converging foam traces make the pull legible from the low
            // camera without drawing a literal spiral on the sea.
            float ang = atan(p.y, p.x);
            float stream = abs(sin(ang * 5.0 + r * 19.0 - uTime * 0.65 - uPull * 2.2));
            stream = pow(1.0 - smoothstep(0.74, 0.98, stream), 2.0);
            stream *= vNearGate * uPull * (0.25 + 0.75 * smoothstep(0.08, 0.42, r));
            foam = clamp(foam + stream * 0.38, 0.0, 1.0);

            vec3 deep = vec3(0.045, 0.095, 0.125);
            vec3 crestCol = vec3(0.67, 0.78, 0.84);
            vec3 foamCol = vec3(0.93, 0.96, 0.98);

            float lift = clamp(vHeight / 8.0 + 0.32, 0.0, 1.0);
            vec3 colour = mix(deep, crestCol, lift * 0.58);
            colour = mix(colour, foamCol, foam);

            // Red lands on already-moving high water/spray; it never paints a
            // flat red layer over the whole patch.
            vec3 red = vec3(0.86, 0.018, 0.008);
            float redCatch = uRed * vNearGate * (0.10 + foam * 0.82 + max(vHeight, 0.0) * 0.035);
            colour = mix(colour, red, clamp(redCatch, 0.0, 0.72));

            float present = smoothstep(0.22, 1.15, abs(vHeight)) * uChaos;
            present = max(present, vWall * 0.68);
            present = max(present, stream * 0.38);

            float edge = 1.0 - smoothstep(0.58, 0.94, r);
            float alpha = clamp((present * 0.32 + foam * 0.56) * edge, 0.0, 0.68);
            if (alpha < 0.006) discard;

            gl_FragColor = vec4(colour, alpha);
          }
        `,
      }),
    [],
  )

  const sprayBuilt = useMemo(() => {
    const count = 320
    let state = 0x71ab39d1 >>> 0
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }

    const seeds = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const o = i * 4
      seeds[o] = rand() * Math.PI * 2
      seeds[o + 1] = 24 + rand() * 62
      seeds[o + 2] = rand()
      seeds[o + 3] = rand()
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4))

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uRed: { value: 0 },
      },
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uAmount;
        varying float vLife;
        varying float vRed;

        void main() {
          float angle = aSeed.x;
          float radius = aSeed.y;
          float phase = aSeed.z;
          float character = aSeed.w;

          float cycle = fract(phase + uTime * (0.20 + character * 0.12));
          float alive = smoothstep(0.02, 0.12, cycle) * (1.0 - smoothstep(0.70, 0.98, cycle));

          // Ballistic splash: launch, rise, fall. Not suspended glitter.
          float launch = radius + cycle * (8.0 + 22.0 * character);
          vec3 pos = vec3(
            cos(angle) * launch,
            0.8 + sin(cycle * 3.14159265) * (7.0 + 18.0 * character) - cycle * cycle * 5.0,
            sin(angle) * launch
          );
          pos.z += cycle * (10.0 + character * 18.0);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.1 + character * 2.5) * alive * uAmount * (92.0 / max(18.0, -mv.z));

          vLife = alive * uAmount;
          vRed = character;
        }
      `,
      fragmentShader: `
        uniform float uRed;
        varying float vLife;
        varying float vRed;

        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float rr = dot(q, q);
          if (rr > 1.0) discard;

          float soft = (1.0 - smoothstep(0.18, 1.0, rr)) * vLife;
          vec3 cold = vec3(0.78, 0.88, 0.94);
          vec3 hot = vec3(0.95, 0.10, 0.035);
          vec3 colour = mix(cold, hot, clamp(uRed * (0.28 + vRed * 0.72), 0.0, 0.72));

          gl_FragColor = vec4(colour, soft * 0.78);
        }
      `,
    })

    return { geometry, material }
  }, [])

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const t = cinematicClock.elapsed
    const u = surfaceMaterial.uniforms

    // One uninterrupted escalation. The pull is readable by ~3s; the large
    // surge is born later, while that pull/spray is still active.
    const chaos = span(t, 0.9, 3.9) * (1 - span(t, 9.1, 11.3) * 0.70)
    const pull = span(t, 1.45, 3.35) * (1 - span(t, 7.7, 9.6) * 0.48)
    const surge = t < 4.25 ? 0 : Math.min(1, (t - 4.25) / 2.35)
    const red = span(t, 5.55, 7.55)

    u.uTime.value += delta
    u.uChaos.value = chaos
    u.uPull.value = pull
    u.uSurge.value = surge
    u.uRed.value = red

    sprayBuilt.material.uniforms.uTime.value += delta
    sprayBuilt.material.uniforms.uAmount.value =
      chaos * span(t, 2.35, 3.65) * (1 - span(t, 8.6, 10.5) * 0.62)
    sprayBuilt.material.uniforms.uRed.value = red

    const s = surface.current
    const p = spray.current
    if (!s || !p) return

    if (warm.current < 4) {
      warm.current++
      s.visible = true
      p.visible = true
      return
    }

    s.visible = chaos > 0.004 || surge > 0.004
    p.visible = sprayBuilt.material.uniforms.uAmount.value > 0.01
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <mesh
        ref={surface}
        position={[PORTAL_X, 0.18, PORTAL_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        renderOrder={13}
      >
        <planeGeometry args={[620, 620, 112, 112]} />
        <primitive object={surfaceMaterial} attach="material" />
      </mesh>

      <points
        ref={spray}
        position={[PORTAL_X, 0, PORTAL_Z]}
        geometry={sprayBuilt.geometry}
        material={sprayBuilt.material}
        visible={false}
        frustumCulled={false}
        renderOrder={14}
      />
    </>
  )
}
