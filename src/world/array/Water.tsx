'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  DynamicDrawUsage,
  PlaneGeometry,
  RepeatWrapping,
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

  const geometryData = useMemo(() => {
    const geometry = new PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS)
    const position = geometry.attributes.position as BufferAttribute
    position.setUsage(DynamicDrawUsage)

    const baseXY = new Float32Array(position.count * 2)
    for (let i = 0; i < position.count; i++) {
      baseXY[i * 2] = position.getX(i)
      baseXY[i * 2 + 1] = position.getY(i)
    }

    return { geometry, baseXY }
  }, [])

  useEffect(() => () => geometryData.geometry.dispose(), [geometryData])

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

  useFrame(({ clock }) => {
    if (nightMat.current) nightMat.current.emissiveIntensity = worldNight.value * 5.5

    const s = cinematicSample
    const disturbance = Math.max(0, Math.min(1, s.disturbance))
    const pull = Math.max(0, Math.min(1, s.pull))
    const surgeAmount = Math.max(0, Math.min(1, s.shockwave))
    const active = Math.max(disturbance, pull, surgeAmount)
    const t = clock.elapsedTime

    // The photographic micro-normal remains, but becomes rougher/faster as the
    // actual geometry breaks up. It is detail on the waves, not the waves.
    const normalBoost = 1 + disturbance * 2.15 + surgeAmount * 0.65
    normalScale.set(amp * normalBoost, amp * normalBoost)
    coarse.offset.set(
      t * (0.0075 + disturbance * 0.014),
      t * (0.0046 + disturbance * 0.010),
    )

    const geometry = geometryData.geometry
    const position = geometry.attributes.position as BufferAttribute

    if (active < 0.002) {
      if (wasDeformed.current) {
        for (let i = 0; i < position.count; i++) position.setZ(i, 0)
        position.needsUpdate = true
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

      position.setZ(i, storm + localBreak + drawDown + surge)
    }

    position.needsUpdate = true

    // The normal map supplies micro-facets; updating geometric normals every
    // second frame is enough for the large wave faces while keeping CPU cost
    // comfortably below doing a full normal rebuild at 60/120Hz.
    normalTick.current = (normalTick.current + 1) & 1
    if (normalTick.current === 0) geometry.computeVertexNormals()

    if (meshRef.current) meshRef.current.frustumCulled = false
  })

  return (
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
  )
}
