'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ShaderMaterial, type Mesh } from 'three'
import { cinematicClock } from './cinematicState'
import { waterline } from './waterline'

/** One patch per column. Four columns, four independent fields. */
const SLOTS = 4

/**
 * What the ocean does when something enormous goes under.
 *
 * One localized field per column rather than a single global ripple, because
 * four structures displacing water in four places is four events — sharing one
 * effect between them would make the whole sea pulse in unison, which is the
 * tell that nothing is really being displaced.
 *
 * Each patch follows its own column's waterline, published every frame by
 * ModelPier, so the foam stays with the intersection as the structure sinks
 * instead of sitting at a fixed spot.
 *
 * DELIBERATELY NOT a blockbuster splash. These are slow and unimaginably
 * heavy: what they make is a broad low-frequency shove of water, a dense
 * collar of foam where the stone cuts the surface, and a slow inward suck as
 * the crown finally goes under. Fast high spray would make them read as light.
 *
 * The wake outlives the column by design. When the last of it disappears the
 * water stays disturbed for a while, so the viewer still knows something was
 * standing there.
 */
export function PillarWake() {
  const meshes = useRef<(Mesh | null)[]>([])

  const makeShader = () => ({
      transparent: true,
      depthWrite: false,
      /*
       * NORMAL blending, not additive.
       *
       * Foam is whitewater: it sits ON the surface and hides what is under it.
       * Added instead of composited it can only brighten already-bright
       * daylit water, which is why a collar computed at nearly full opacity
       * was still almost invisible — the sea it was being added to was
       * brighter than the foam itself. Compositing lets it read on a sunlit
       * ocean, which is the only lighting this beat ever plays in.
       */
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        /** 0 standing, 1 gone. Drives the ring's radius and the foam. */
        uDepth: { value: 0 },
        /** Fades the whole patch, including the residual wake. */
        uAmount: { value: 0 },
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
        uniform float uDepth;
        uniform float uAmount;

        float ring(float r, float c, float w) {
          return exp(-pow((r - c) / w, 2.0));
        }

        // Cheap value noise, for foam that is not a smooth gradient.
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          // The displacement wave leaves as the column descends and keeps
          // travelling after it has gone.
          float lead = uDepth * 0.55 + 0.06;

          // Broad outward pressure: low, wide, heavy.
          /*
           * The collar radius, declared before anything uses it.
           *
           * It sits at the column's own radius and drifts outward as the
           * structure sinks, which is where displaced water actually goes.
           */
          float rim = 0.17 + uDepth * 0.06;

          // The broad shove of water, leaving from the collar outward.
          float press = ring(r, rim + lead * 0.6, 0.22) * (1.0 - uDepth * 0.3);

          /*
           * The collar of foam sits where the stone meets the water, so it
           * TIGHTENS as the column sinks — the intersection shrinks toward
           * nothing as the crown goes under.
           */
          /*
           * A RING AROUND the stone, not a disc beneath it.
           *
           * This was a filled disc centred on the column — and the column is
           * standing on top of it, so every bit of foam was occluded by the
           * very thing it was supposed to be breaking against. Proven by
           * flooding the patch with flat colour: the geometry had been
           * rendering correctly the whole time and simply could not be seen.
           */
          /*
           * WIDE, because the camera is almost level with the sea.
           *
           * A narrow ring lying flat on the water compresses to a couple of
           * pixels at this grazing angle — geometrically correct and visually
           * absent. Broadening it trades a little crispness for a collar that
           * actually reads from the only viewpoint this scene is ever seen
           * from.
           */
          float collar = ring(r, rim, 0.13);
          /*
           * Churn with a FLOOR.
           *
           * Multiplying two noise fields together averages about a quarter,
           * so the foam was mostly transparent and the collar read as a faint
           * wash over bright daylit water. Foam is whitewater: it is mostly
           * opaque with texture in it, not texture with occasional opacity.
           */
          /*
           * High contrast, and finer.
           *
           * With the churn floored at 0.45 the collar composited as a smooth
           * pale ellipse — the shape of foam without the texture of it. Real
           * whitewater is patchy: bright where air is trapped, open water
           * between. Dropping the floor and lifting the frequency puts holes
           * back in it.
           */
          float n1 = noise(p * 22.0 + uTime * 1.1);
          float n2 = noise(p * 46.0 - uTime * 1.7);
          float churn = smoothstep(0.18, 0.78, n1 * 0.65 + n2 * 0.45);
          float foam = collar * churn * (1.15 + uDepth * 1.3);

          // A slow inward pull right at the end, as the water closes over.
          float suck = smoothstep(0.72, 1.0, uDepth) * ring(r, rim * 0.7, 0.10) * 0.7;

          float h = press * 0.8 + foam + suck;

          // Foam is white water; the pressure wave only bends the surface.
          vec3 col = mix(vec3(0.55, 0.63, 0.74), vec3(0.97, 0.99, 1.0), min(1.0, foam * 1.9));
          float a = min(h * uAmount * 2.1, 0.95);
          gl_FragColor = vec4(col, a);
        }
      `,
  })

  /*
   * ONE MATERIAL PER COLUMN, each with its OWN uniforms.
   *
   * A single memoised parameter object was being handed to all four
   * ShaderMaterials, and three.js keeps a REFERENCE to the uniforms it is
   * given — so every patch shared one set of values and the last column
   * written each frame overwrote the other three. Four independent fields was
   * the entire point; they were quietly acting as one.
   */
  const materials = useMemo(
    () => Array.from({ length: SLOTS }, () => new ShaderMaterial(makeShader())),
    [],
  )

  /*
   * Per-frame mutation of three.js objects — uniforms, visibility, transforms
   * — inside a frame callback. The compiler sees values that came out of a
   * useMemo being written to and assumes a render-phase mutation; it cannot
   * model an imperative renderer driven from React. See the fuller note in
   * PortalCinematic.
   */
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    /*
     * The wake has to DIE.
     *
     * Its strength was keyed off how far the column had sunk, and the descent
     * curve settles just short of 1 — so every patch sat at full strength for
     * the rest of the piece and two pale ellipses were still on the water in
     * the night endpoint, which is a signed-off frame. Disturbed water calms
     * down; it needed a clock, not a position.
     *
     * Long enough that the sea is still visibly troubled through ALONE, gone
     * by the time the machine wakes.
     */
    const et = cinematicClock.elapsed
    const settle = et <= 6.2 ? 1 : Math.max(0, 1 - (et - 6.2) / 1.6)
    // Reading a Map's values allocates an iterator, so the entries are pulled
    // by index into fixed slots instead — this runs every frame.
    let i = 0
    for (const w of waterline.values()) {
      if (i >= SLOTS) break
      const g = meshes.current[i]
      const m = materials[i]
      i++
      if (!g || !m) continue

      m.uniforms.uTime.value += delta
      m.uniforms.uDepth.value = w.depth

      /*
       * Present while the column is moving AND for a while afterwards. The
       * fade is driven by depth rather than by the clock so a scrub lands on
       * exactly the right amount of wake.
       */
      const active = w.depth > 0.001 && w.depth < 0.999
      const residual = w.depth >= 0.999 ? 0.45 : 0
      const amount = active ? Math.min(1, w.depth * 3.2) : residual
      m.uniforms.uAmount.value = amount * settle
      g.visible = amount * settle > 0.004

      const span = w.height * 0.95
      g.position.set(w.x, 0.32, w.z)
      g.scale.set(span, span, 1)
    }
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { meshes.current[i] = m }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </>
  )
}
