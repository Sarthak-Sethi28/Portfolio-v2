'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ShaderMaterial, type Mesh } from 'three'
import { cinematicClock } from './cinematicState'

const PORTAL_X = 0
const PORTAL_Z = -150

/**
 * THE SEA LOSES CONTROL.
 *
 * This replaces a system that raised a smooth circular dome and darkened a
 * disc under it — a membrane floating on the water. The problem with that
 * shape is that it is a shape: water under stress does not form a clean
 * paraboloid, and anything radially symmetric and smooth reads as a graphic
 * laid on the ocean rather than as the ocean doing something.
 *
 * So there is no dome, no cavity and no circle here. The height field is
 * RIDGED noise — folded so its valleys become sharp creases — advected inward
 * toward the gate, which gives peaks that break rather than swell. Four
 * octaves at different speeds and scales keep the motion from ever repeating
 * into a pattern the eye can lock onto.
 *
 * The surge is a travelling wall, not a ring: a broad crest leaving the portal
 * whose radius is perturbed by angle, so its front is ragged and it arrives at
 * different distances around the circle.
 *
 * Foam is where the water is steepest and highest, which is where whitewater
 * actually forms — not a texture painted on afterwards. It composites rather
 * than adding, because whitewater hides what is beneath it.
 *
 * Red does not replace any of this. It arrives as a light that the existing
 * crests and spray catch, so the same violent water simply becomes lit from
 * the gate.
 */
export function OceanChaos() {
  const mesh = useRef<Mesh>(null)
  const warm = useRef(0)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          /** Overall instability, 0 calm to 1 chaotic. */
          uChaos: { value: 0 },
          /** How hard the water is being drawn toward the gate. */
          uPull: { value: 0 },
          /** Position of the travelling surge wall, 0 unborn to 1 gone. */
          uSurge: { value: 0 },
          /** How much of the gate's red the water is catching. */
          uRed: { value: 0 },
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
          uniform float uChaos;
          uniform float uPull;
          uniform float uSurge;
          uniform float uRed;

          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                       mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }

          /*
           * RIDGED noise. Folding the field about its midpoint turns smooth
           * valleys into sharp creases, which is the difference between a
           * swell and a breaking peak. Plain fbm can only ever look calm.
           */
          float ridge(vec2 p) {
            return 1.0 - abs(noise(p) * 2.0 - 1.0);
          }

          float chop(vec2 p, float t) {
            float s = 0.0;
            s += ridge(p * 3.0  + vec2(t * 0.55, -t * 0.40)) * 0.50;
            s += ridge(p * 7.0  - vec2(t * 0.85,  t * 0.60)) * 0.27;
            s += ridge(p * 15.0 + vec2(-t * 1.30, t * 1.05)) * 0.15;
            s += ridge(p * 31.0 + vec2(t * 2.10, t * 1.70)) * 0.08;
            return s;
          }

          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            if (r > 1.0) discard;

            vec2 dir = r > 0.0001 ? p / r : vec2(0.0);

            /*
             * DRAWN IN. The field is sampled further along its own radius the
             * closer it is to the gate, so the texture of the water slides
             * inward — the surface moves toward the portal instead of a shape
             * appearing on top of it.
             */
            /*
             * A much tighter falloff.
             *
             * At 0.62 the disturbance still had real strength out at the edge
             * of a six-hundred-unit patch, and since the camera sits near that
             * edge the whole foreground went white — the sea did not look
             * violent, it looked like fog. The event belongs to the water
             * AROUND THE GATE; the ocean the viewer is standing over should
             * still be recognisably ocean.
             */
            float nearGate = 1.0 - smoothstep(0.0, 0.34, r);
            vec2 drawn = p - dir * uPull * nearGate * 0.55;

            float h = chop(drawn * 1.6, uTime) * uChaos;

            // Violence concentrates near the gate and falls off outward.
            h *= 0.12 + nearGate * 1.55;

            /*
             * THE SURGE: a wall, not a ring.
             *
             * Its radius is perturbed by angle so the front is ragged and
             * reaches different distances around the circle — a clean annulus
             * is the tell of a drawn effect.
             */
            float ang = atan(p.y, p.x);
            float ragged = noise(vec2(ang * 2.4, uTime * 0.25)) * 0.16
                         + noise(vec2(ang * 5.7, uTime * 0.4)) * 0.07;
            float front = uSurge * 1.05 + ragged - 0.08;
            float wall = exp(-pow((r - front) / 0.17, 2.0));
            float wallAlive = uSurge > 0.001 ? (1.0 - uSurge) : 0.0;
            // The wall carries real height but is not allowed to whiteout.
            h += wall * wallAlive * 0.95;

            // Surface normal from the height field's own slope.
            float e = 0.004;
            float hx = chop((drawn + vec2(e, 0.0)) * 1.6, uTime) - chop((drawn - vec2(e, 0.0)) * 1.6, uTime);
            float hy = chop((drawn + vec2(0.0, e)) * 1.6, uTime) - chop((drawn - vec2(0.0, e)) * 1.6, uTime);
            float steep = length(vec2(hx, hy)) * 22.0;
            vec3 n = normalize(vec3(-hx * 30.0, -hy * 30.0, 0.5));

            vec3 lightDir = normalize(vec3(0.38, 0.32, 0.87));
            float spec = pow(max(dot(n, lightDir), 0.0), 5.0);

            /*
             * FOAM where the water is both HIGH and STEEP — which is where a
             * crest is actually tearing itself apart. Painting foam by radius
             * instead would put it in neat bands.
             */
            // Higher threshold: foam only where the water is genuinely tearing,
            // not merely textured.
            float crest = smoothstep(0.78, 1.30, h) * smoothstep(0.35, 1.05, steep);
            float spray = crest * (0.55 + 0.45 * noise(drawn * 40.0 + uTime * 3.0));
            float foam = clamp(crest * 0.7 + spray * 0.38, 0.0, 1.0);

            // Nothing at all until the sea is actually disturbed.
            float present = smoothstep(0.03, 0.30, abs(h)) * uChaos;
            float edge = 1.0 - smoothstep(0.38, 0.86, r);

            vec3 water = vec3(0.40, 0.49, 0.60) * (0.35 + spec * 1.6);
            vec3 white = vec3(0.93, 0.96, 1.0);
            vec3 col = mix(water, white, foam);

            /*
             * The gate's light lands ON the chaos rather than replacing it:
             * strongest on the crests and spray, which are the parts facing
             * up and out toward the portal, and nearly absent in the troughs.
             */
            vec3 red = vec3(1.0, 0.13, 0.06);
            float catchRed = uRed * nearGate * (0.25 + foam * 0.95 + spec * 0.6);
            col = mix(col, red, clamp(catchRed, 0.0, 0.82));

            /*
             * Capped well below opaque. This composites over the real ocean,
             * and the moment it can fully replace it the shot stops being
             * water and starts being a white plane.
             */
            float a = clamp((present * 0.30 + foam * 0.62) * edge, 0.0, 0.66);
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    [],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const g = mesh.current
    if (!g) return
    const t = cinematicClock.elapsed
    const u = material.uniforms
    u.uTime.value += delta

    const sp = (a: number, b: number) => {
      const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
      return x * x * (3 - 2 * x)
    }

    /*
     * ONE ESCALATION, not a list of effects.
     *
     * Instability starts small at 1s, is genuinely breaking by 3s, is at its
     * worst through 4-6s, and only calms once the gate has taken over. It
     * never fully returns to glass, because the beat after this is the world
     * turning to night and a suddenly serene ocean would undo the event.
     */
    const chaos = sp(1.0, 4.2) * (1 - sp(9.0, 11.2) * 0.72)
    u.uChaos.value = chaos
    u.uPull.value = sp(1.8, 3.6) * (1 - sp(7.5, 9.5) * 0.6)

    // The surge wall is born at 4.6 and takes about two seconds to cross.
    u.uSurge.value = t < 4.6 ? 0 : Math.min(1, (t - 4.6) / 2.1)

    // Red reaches the water as the machine charges, and stays while it burns.
    u.uRed.value = Math.min(1, sp(5.6, 7.4) * 1.0)

    /*
     * Drawn for a few frames at zero strength while the page settles, so the
     * program is compiled and linked before anyone presses anything — a shader
     * compile is a synchronous stall, and this one would land in the beat it
     * belongs to.
     */
    if (warm.current < 4) {
      warm.current++
      g.visible = true
      return
    }
    g.visible = chaos > 0.004 || u.uSurge.value > 0.004
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <mesh
      ref={mesh}
      position={[PORTAL_X, 0.3, PORTAL_Z]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[620, 620]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
