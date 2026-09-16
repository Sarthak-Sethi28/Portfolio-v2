'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  DynamicDrawUsage,
  Float32BufferAttribute,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  Vector2,
  type BufferAttribute,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import type { Palette } from '../atmosphere/palette'
import { cinematicSample, worldNight } from '../cinematic/cinematicState'

const PORTAL_Z = -150
const WATER_SIZE = 1600
const WATER_SEGMENTS = 96

function gaussian(x: number, width: number): number {
  const q = x / width
  return Math.exp(-(q * q))
}

/**
 * The actual reflective ocean surface.
 *
 * At rest it is still the photographed-normal-map salt plain we liked. During
 * the F cinematic, however, the REAL reflector geometry now moves. The old
 * white overlay made a second translucent surface heave above an otherwise
 * flat blue sea, which is exactly why it looked like a white thing sitting on
 * top of the water. This mesh now carries the broad swell, short chop, portal
 * draw-down and travelling surge itself, so reflections/pillars/red light live
 * on the moving surface rather than underneath a separate effect.
 */
export function Water({
  palette,
  roughness,
  reflectorResolution,
  distort,
}: {
  palette: Palette
  roughness: number
  reflectorResolution: number
  /** Rain amount. Low but never zero — still water still moves. */
  distort: number
}) {
  const reflective = reflectorResolution > 0
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const meshRef = useRef<Mesh>(null)
  const nightMat = useRef<MeshStandardMaterial>(null)
  const wasDeformed = useRef(false)
  const normalTick = useRef(0)
  /** Accumulated normal-map travel. See the note in the frame loop. */
  const scroll = useRef({ x: 0, y: 0 })

  const geometryData = useMemo(() => {
    const geometry = new PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS)
    const position = geometry.attributes.position as BufferAttribute
    position.setUsage(DynamicDrawUsage)

    const baseXY = new Float32Array(position.count * 2)
    // A fixed per-vertex random, so foam breaks up unevenly instead of forming
    // the smooth bands any purely analytic field produces.
    const grain = new Float32Array(position.count)
    let seed = 0x2f6e2b1 >>> 0
    for (let i = 0; i < position.count; i++) {
      baseXY[i * 2] = position.getX(i)
      baseXY[i * 2 + 1] = position.getY(i)
      seed = (seed * 1664525 + 1013904223) >>> 0
      grain[i] = seed / 4294967296
    }

    const foam = new Float32BufferAttribute(new Float32Array(position.count), 1)
    foam.setUsage(DynamicDrawUsage)
    geometry.setAttribute('aFoam', foam)

    // Heights are written in one pass and read back in a second, because a
    // vertex cannot know whether it is a crest until its neighbours exist.
    const heights = new Float32Array(position.count)

    return { geometry, baseXY, grain, foam, heights }
  }, [])

  useEffect(() => () => geometryData.geometry.dispose(), [geometryData])

  /**
   * Foam is drawn on the ocean's OWN vertices.
   *
   * It shares the exact deformed geometry, so there is no second surface able
   * to float above the water and nothing that can read as a sheet or membrane.
   * Where aFoam is zero — most of the sea, most of the time — the shader
   * discards and the blue reflector is all that remains.
   */
  const foamMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: {
          uNight: { value: 0 },
        },
        vertexShader: `
          attribute float aFoam;
          varying float vFoam;
          varying vec2 vPos;

          void main() {
            vFoam = aFoam;
            vPos = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying float vFoam;
          varying vec2 vPos;
          uniform float uNight;

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

          void main() {
            if (vFoam < 0.04) discard;

            /*
             * THE MASK HAS TO CUT, NOT DIM.
             *
             * The previous smoothstep averaged around 0.4 almost everywhere,
             * so it lowered the foam's opacity uniformly instead of removing
             * it in places — which is the difference between broken whitewater
             * and a translucent sheet. These octaves are an order of magnitude
             * higher in frequency and are thresholded near the TOP of their
             * range, so most fragments fail outright and the survivors are
             * small. The first octave is stretched 4:1 so what does survive
             * runs in streaks along the crest rather than in round dabs.
             */
            vec2 streak = vec2(vPos.x * 0.085, vPos.y * 0.34);
            float o1 = noise(streak);
            float o2 = noise(vPos * 0.62);
            float o3 = noise(vPos * 1.45);
            float mask = o1 * 0.5 + o2 * 0.32 + o3 * 0.18;

            // Strong foam is allowed to survive a slightly lower bar, so caps
            // build up rather than dissolving evenly with everything else.
            float bar = mix(0.62, 0.44, clamp(vFoam, 0.0, 1.0));
            float bite = smoothstep(bar, bar + 0.16, mask);
            if (bite <= 0.0) discard;

            float a = vFoam * bite;
            if (a < 0.05) discard;

            vec3 day = vec3(0.84, 0.89, 0.92);
            vec3 night = vec3(0.34, 0.42, 0.50);
            vec3 colour = mix(day, night, clamp(uNight, 0.0, 1.0));

            // Capped well below opaque: even a full cap is spray over water,
            // and the reflector underneath must stay readable through it.
            gl_FragColor = vec4(colour, min(a, 0.34));
          }
        `,
      }),
    [],
  )

  useEffect(() => () => foamMaterial.dispose(), [foamMaterial])

  const stars = useTexture('/sky/night.jpg') as Texture
  const starMap = useMemo(() => {
    const t = stars.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(1.4, 1.4)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [stars, maxAniso])

  const base = useTexture('/water-normal.jpg', (t) => {
    const tex = (Array.isArray(t) ? t[0] : t) as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.anisotropy = maxAniso
  }) as Texture

  const coarse = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(22, 22)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [base, maxAniso])

  const amp = 0.5 + distort * 0.9
  const normalScale = useMemo(() => new Vector2(amp, amp), [amp])

  /* eslint-disable react-hooks/immutability */
  useFrame(({ clock }, delta) => {
    if (nightMat.current) nightMat.current.emissiveIntensity = worldNight.value * 5.5
    foamMaterial.uniforms.uNight.value = worldNight.value

    const s = cinematicSample
    const disturbance = Math.max(0, Math.min(1, s.disturbance))
    const pull = Math.max(0, Math.min(1, s.pull))
    const surgeAmount = Math.max(0, Math.min(1, s.shockwave))

    /*
     * THE NIGHT SEA IS NOT A MIRROR.
     *
     * Every deformation above is an envelope off the forward timeline, and all
     * of them are spent by the time the destination is reached — so the arrival
     * held a dead, perfectly flat ocean, and the return journey set out across
     * it. This keeps a real swell running for as long as the world is dark. It
     * is driven by worldNight rather than by the clock, so it survives the hold
     * at PROJECTS, stays alive through the whole return approach, and recedes
     * on its own as day comes back up underneath the tunnel.
     *
     * Day is untouched: at worldNight 0 this term is exactly zero.
     */
    const living = Math.max(0, Math.min(1, worldNight.value))
    const active = Math.max(disturbance, pull, surgeAmount, living * 0.9)
    const t = clock.elapsedTime

    // The photographic micro-normal remains, but becomes rougher/faster as the
    // actual geometry breaks up. It is detail on the waves, not the waves.
    const normalBoost = 1 + disturbance * 2.15 + surgeAmount * 0.65
    normalScale.set(amp * normalBoost, amp * normalBoost)

    /*
     * THE SCROLL IS INTEGRATED, NOT RECOMPUTED.
     *
     * This used to be `offset = elapsedTime * (base + disturbance * k)` — a
     * position derived from absolute time multiplied by a speed that CHANGES.
     * The instant F was pressed and `disturbance` left zero, the whole
     * expression jumped by `elapsedTime * disturbance * k`, and the ocean's
     * surface texture slid bodily sideways before a single wave had moved.
     *
     * Worse, the size of that jump was proportional to how long the page had
     * been open: barely visible a few seconds in, and around nine texture tiles
     * of instant sideways travel after half a minute of looking at the view.
     * Which is exactly why it read as the sea itself shifting left.
     *
     * Accumulating distance per frame instead means a change of speed is only
     * ever a change of speed. There is no term left for a jump to appear in.
     */
    const dt = Math.min(delta, 1 / 20)
    scroll.current.x += dt * (0.0075 + disturbance * 0.014)
    scroll.current.y += dt * (0.0046 + disturbance * 0.010)
    coarse.offset.set(scroll.current.x, scroll.current.y)

    const geometry = geometryData.geometry
    const position = geometry.attributes.position as BufferAttribute

    const foamAttr = geometryData.foam
    const heights = geometryData.heights

    if (active < 0.002) {
      if (wasDeformed.current) {
        for (let i = 0; i < position.count; i++) {
          position.setZ(i, 0)
          foamAttr.setX(i, 0)
        }
        position.needsUpdate = true
        foamAttr.needsUpdate = true
        geometry.computeVertexNormals()
        wasDeformed.current = false
      }
      return
    }

    wasDeformed.current = true

    for (let i = 0; i < position.count; i++) {
      const x = geometryData.baseXY[i * 2]
      const localY = geometryData.baseXY[i * 2 + 1]
      // Plane local +Y becomes world -Z after the -90deg X rotation.
      const worldZ = -localY

      // Whole-ocean storm field: several wavelengths crossing at different
      // angles. This is deliberately irregular and directional rather than a
      // concentric procedural ring around the gate.
      const swellA = Math.sin(x * 0.018 + worldZ * 0.026 - t * 1.55) * 1.55
      const swellB = Math.sin(x * 0.037 - worldZ * 0.021 + t * 2.05 + 1.7) * 0.92
      const chopA = Math.sin(x * 0.071 + worldZ * 0.058 - t * 3.15 + 0.4) * 0.48
      const chopB = Math.sin(x * 0.113 - worldZ * 0.086 + t * 4.05 + 2.2) * 0.27
      const storm = (swellA + swellB + chopA + chopB) * disturbance * (0.72 + disturbance * 1.18)

      const dz = worldZ - PORTAL_Z
      const d = Math.hypot(x, dz)
      const nearGate = gaussian(d, 135)
      const throat = gaussian(d, 44)

      // Near the machine, the same water gets substantially more violent. The
      // phase is broken with X/Z terms so it never becomes a perfect whirlpool.
      const localBreak = nearGate * disturbance * (
        Math.sin(d * 0.098 - t * 4.15 + x * 0.013) * 2.25 +
        Math.sin(x * 0.084 + dz * 0.063 + t * 3.30) * 1.35
      )
      const drawDown = -pull * throat * (3.8 + 1.2 * Math.sin(t * 2.1 + x * 0.025))

      // A broad crooked front travels FROM the portal toward camera. It is a
      // real raised band in the base ocean, not a white translucent sheet.
      const frontZ = PORTAL_Z + surgeAmount * 355
      const crookedFront = frontZ + Math.sin(x * 0.018 + t * 0.7) * 13 + Math.sin(x * 0.049) * 7
      const frontBand = gaussian(worldZ - crookedFront, 48) * gaussian(x, 360)
      const surge = frontBand * surgeAmount * (5.8 + disturbance * 3.0)

      // The night swell: long, slow, crossing at a different angle to the storm
      // so the two never beat against each other into a standing pattern.
      const nightSwell =
        (Math.sin(x * 0.0126 + worldZ * 0.0193 - t * 0.78) * 1.32 +
          Math.sin(x * 0.0295 - worldZ * 0.0162 + t * 1.07 + 2.4) * 0.74 +
          Math.sin(x * 0.0615 + worldZ * 0.0472 - t * 1.85 + 1.1) * 0.29) *
        living

      const height = storm + localBreak + drawDown + surge + nightSwell
      position.setZ(i, height)
      heights[i] = height
    }

    /*
     * FOAM SITS ON CRESTS, AND ONLY ON CRESTS.
     *
     * The previous pass asked "is this vertex high?" and got back half the
     * ocean: a broad swell passes a height test along its entire flank, and a
     * value that varies smoothly across a 16-unit grid then interpolates into
     * exactly the soft pale gradient this is supposed to prevent.
     *
     * But a crest is not a high point, it is a SHARP one — water standing above
     * the water immediately around it. So this second pass reads each vertex
     * against its four grid neighbours and asks two different questions: how
     * far does it stand proud of its own neighbourhood, and how steep is the
     * surface there. Both fall to zero down a smooth face, so the result can
     * only ever be a cap or a streak. Nothing radial is consulted at all, which
     * is what makes a halo around the machine impossible rather than merely
     * unlikely.
     */
    const ROW = WATER_SEGMENTS + 1
    const CELL = WATER_SIZE / WATER_SEGMENTS

    for (let i = 0; i < position.count; i++) {
      const col = i % ROW
      const row = (i / ROW) | 0

      // An edge vertex has no outside neighbour; falling back to its own value
      // makes both measures zero there rather than inventing a cliff.
      const c = heights[i]
      const l = col > 0 ? heights[i - 1] : c
      const r = col < ROW - 1 ? heights[i + 1] : c
      const u = row > 0 ? heights[i - ROW] : c
      const dn = row < ROW - 1 ? heights[i + ROW] : c

      // Positive only at caps, negative in every trough, ~0 down a smooth face.
      const proud = c - (l + r + u + dn) * 0.25
      const slope = ((Math.abs(r - l) + Math.abs(dn - u)) * 0.5) / CELL

      const cap = Math.max(0, proud - 0.30) * 0.9
      const steep = Math.max(0, slope - 0.030) * 6.5
      const g = geometryData.grain[i]

      // Both must hold. Taking the PRODUCT means a tall but gently sloping
      // swell earns nothing at all, however high it rises.
      let foam = cap * steep * (0.25 + g * 1.5)
      foam = foam > 0.20 ? Math.min(1, (foam - 0.20) * 0.85) : 0
      foamAttr.setX(i, foam)
    }

    foamAttr.needsUpdate = true
    position.needsUpdate = true

    // The normal map supplies micro-facets; updating geometric normals every
    // second frame is enough for the large wave faces while keeping CPU cost
    // comfortably below doing a full normal rebuild at 60/120Hz.
    normalTick.current = (normalTick.current + 1) & 1
    if (normalTick.current === 0) geometry.computeVertexNormals()

    if (meshRef.current) meshRef.current.frustumCulled = false
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <>
    <mesh
      ref={meshRef}
      geometry={geometryData.geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      frustumCulled={false}
    >
      {reflective ? (
        <MeshReflectorMaterial
          blur={[30, 9]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          mixStrength={2.6}
          roughness={roughness}
          depthScale={0}
          color={palette.waterTint}
          metalness={1}
          mirror={1}
          normalMap={coarse}
          normalScale={normalScale}
          envMapIntensity={1.35}
          reflectorOffset={0}
        />
      ) : (
        <meshStandardMaterial
          color={palette.waterTint}
          roughness={Math.max(roughness, 0.06)}
          metalness={1}
          envMapIntensity={2.1}
          normalMap={coarse}
          normalScale={normalScale}
          emissiveMap={starMap}
          emissive="#ffffff"
          emissiveIntensity={0}
          ref={nightMat}
        />
      )}
    </mesh>

      {/*
        * The foam pass. Same geometry, same transform, so it is welded to the
        * wave faces rather than hovering over them. It is left mounted at all
        * times: with aFoam at zero every fragment discards, which costs nothing
        * on screen and gets the shader compiled long before F is ever pressed.
        */}
      <mesh
        geometry={geometryData.geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        frustumCulled={false}
        renderOrder={12}
      >
        <primitive object={foamMaterial} attach="material" />
      </mesh>
    </>
  )
}
