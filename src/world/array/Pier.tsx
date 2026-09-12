'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, RepeatWrapping, Vector2, type MeshStandardMaterial, type Texture } from 'three'
import type { Placement } from '../geometry/layout'
import type { Palette } from '../atmosphere/palette'
import { createRng, range } from '@/lib/rng'

/**
 * A compound pier — a real column, not a textured slab.
 *
 * A pillar has ANATOMY, and naming it is most of the work:
 *
 *   BASE     a square plinth, then a torus roll, then a fillet. Three steps,
 *            each smaller, carrying the shaft down to the ground.
 *   SHAFT    the body, with ENTASIS — the slight swelling at mid-height that
 *            every classical column has, because a perfectly straight shaft
 *            looks concave to the eye.
 *   SHAFTS   slim colonnettes clustered around the core. This is the gothic
 *            compound pier, and it is the single most legible piece of
 *            carving at distance: it turns one smooth cylinder into a bundle
 *            of verticals that catch light separately and throw shadow between
 *            themselves.
 *   ANNULETS rings binding the colonnettes at intervals, which stop the
 *            bundle reading as a comb and divide the height.
 *   CAPITAL  a flared bell, a necking below it, and a square abacus on top —
 *            the transition from round shaft to whatever it carries.
 *
 * All of it is turned geometry: cylinders, tori, boxes. What makes it read as
 * carved is not surface detail but the PROFILE — the silhouette stepping in
 * and out as it rises.
 */
export function Pier({
  placement,
  palette,
  stoneNormal,
  stoneRough,
  emphasis = 0,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  placement: Placement
  palette: Palette
  stoneNormal: Texture
  stoneRough: Texture
  emphasis?: number
  onPointerOver?: () => void
  onPointerOut?: () => void
  onClick?: () => void
}) {
  const { position, rotationY, tilt, width, height, submerge, ruined } = placement
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const tile = (t: Texture, rx: number, ry: number) => {
    const c = t.clone()
    c.wrapS = c.wrapT = RepeatWrapping
    c.repeat.set(rx, ry)
    c.anisotropy = maxAniso
    c.needsUpdate = true
    return c
  }

  const normalMap = useMemo(
    () => tile(stoneNormal, Math.max(2, width / 3), Math.max(3, height / 6)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stoneNormal, width, height, maxAniso],
  )
  const roughMap = useMemo(
    () => tile(stoneRough, Math.max(2, width / 3), Math.max(3, height / 6)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stoneRough, width, height, maxAniso],
  )
  const normalScale = useMemo(() => new Vector2(1.6, 1.6), [])

  const mats = useRef<MeshStandardMaterial[]>([])
  const eased = useRef(0)
  useFrame((_, delta) => {
    eased.current = MathUtils.damp(eased.current, emphasis, 7, delta)
    for (const m of mats.current) {
      if (!m) continue
      m.emissiveIntensity = eased.current * 0.05
      m.envMapIntensity = 0.35 + eased.current * 0.12
    }
  })
  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m)
  }

  const mat = (
    <meshStandardMaterial
      ref={collect}
      color={palette.monolith}
      roughness={0.9}
      metalness={0}
      envMapIntensity={0.35}
      normalMap={normalMap}
      normalScale={normalScale}
      roughnessMap={roughMap}
      emissive={palette.sunColor}
      emissiveIntensity={0}
    />
  )

  // --- proportions, as fractions of total height ---------------------------
  const H = height
  const R = width / 2
  const baseH = H * 0.075
  const capH = H * 0.1
  const shaftH = H - baseH - capH
  const coreR = R * 0.62

  const variant = useMemo(() => {
    const rng = createRng(Math.round(width * 977 + height * 131))
    return {
      colonnettes: 8 + Math.floor(rng() * 5),
      annulets: 2 + Math.floor(rng() * 2),
      colR: R * range(rng, 0.15, 0.21),
    }
  }, [width, height, R])

  const colonnettes = useMemo(
    () =>
      Array.from({ length: variant.colonnettes }, (_, i) => {
        const a = (i / variant.colonnettes) * Math.PI * 2
        return { a, x: Math.cos(a) * (coreR + variant.colR * 0.72), z: Math.sin(a) * (coreR + variant.colR * 0.72) }
      }),
    [variant, coreR],
  )

  const annulets = useMemo(
    () =>
      Array.from({ length: variant.annulets }, (_, i) => baseH + (shaftH * (i + 1)) / (variant.annulets + 1)),
    [variant.annulets, baseH, shaftH],
  )

  const y0 = -H / 2
  const noHit = useMemo(() => () => null, [])

  const handlers = {
    onPointerOver:
      onPointerOver &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onPointerOver()
      }),
    onPointerOut: onPointerOut && (() => onPointerOut()),
    onClick:
      onClick &&
      ((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onClick()
      }),
  }

  return (
    <group position={position} rotation={[0, rotationY, tilt]}>
      {/* One invisible collider does all the raycasting. */}
      {onClick && (
        <mesh {...handlers} visible={false}>
          <cylinderGeometry args={[R * 1.2, R * 1.2, H, 8]} />
        </mesh>
      )}

      {/* --- BASE: plinth, torus, fillet ---------------------------------- */}
      <mesh castShadow receiveShadow position={[0, y0 + baseH * 0.18, 0]} raycast={noHit}>
        <boxGeometry args={[R * 2.25, baseH * 0.36, R * 2.25]} />
        {mat}
      </mesh>
      <mesh castShadow receiveShadow position={[0, y0 + baseH * 0.52, 0]} raycast={noHit}>
        <cylinderGeometry args={[R * 0.98, R * 1.08, baseH * 0.3, 24]} />
        {mat}
      </mesh>
      <mesh castShadow receiveShadow position={[0, y0 + baseH * 0.76, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noHit}>
        <torusGeometry args={[coreR * 1.12, baseH * 0.17, 8, 28]} />
        {mat}
      </mesh>

      {/* --- SHAFT with entasis ------------------------------------------- */}
      <mesh castShadow receiveShadow position={[0, y0 + baseH + shaftH / 2, 0]} raycast={noHit}>
        {/* Top narrower than bottom: the taper every real column has. */}
        <cylinderGeometry args={[coreR * 0.88, coreR, shaftH, 20]} />
        {mat}
      </mesh>

      {/* --- COLONNETTES: the bundle of slim shafts ------------------------ */}
      {colonnettes.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <mesh castShadow receiveShadow position={[0, y0 + baseH + shaftH / 2, 0]} raycast={noHit}>
            <cylinderGeometry args={[variant.colR * 0.9, variant.colR, shaftH, 10]} />
            {mat}
          </mesh>
          {/* Each gets its own little base and cap, as they do in real work. */}
          <mesh castShadow receiveShadow position={[0, y0 + baseH * 0.94, 0]} raycast={noHit}>
            <cylinderGeometry args={[variant.colR * 1.35, variant.colR * 1.5, baseH * 0.22, 10]} />
            {mat}
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[0, y0 + baseH + shaftH + capH * 0.08, 0]}
            raycast={noHit}
          >
            <cylinderGeometry args={[variant.colR * 1.5, variant.colR * 1.2, capH * 0.2, 10]} />
            {mat}
          </mesh>
        </group>
      ))}

      {/* --- ANNULETS binding the bundle ---------------------------------- */}
      {annulets.map((y, i) => (
        <mesh
          key={`ann-${i}`}
          castShadow
          receiveShadow
          position={[0, y0 + y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noHit}
        >
          <torusGeometry args={[coreR + variant.colR * 0.85, variant.colR * 0.42, 8, 30]} />
          {mat}
        </mesh>
      ))}

      {/* --- CAPITAL: necking, bell, abacus -------------------------------- */}
      {!ruined && (
        <>
          <mesh
            castShadow
            receiveShadow
            position={[0, y0 + baseH + shaftH + capH * 0.12, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={noHit}
          >
            <torusGeometry args={[coreR * 0.94, capH * 0.06, 8, 26]} />
            {mat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, y0 + baseH + shaftH + capH * 0.45, 0]} raycast={noHit}>
            {/* The bell: flaring out from shaft to abacus. */}
            <cylinderGeometry args={[R * 1.12, coreR * 0.9, capH * 0.5, 20]} />
            {mat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, y0 + baseH + shaftH + capH * 0.8, 0]} raycast={noHit}>
            <boxGeometry args={[R * 2.4, capH * 0.2, R * 2.4]} />
            {mat}
          </mesh>
        </>
      )}

      {/* A broken pier keeps a jagged stub where its capital was. */}
      {ruined && (
        <mesh
          castShadow
          receiveShadow
          position={[0, y0 + baseH + shaftH + capH * 0.12, 0]}
          rotation={[0, 0.4, 0.05]}
          raycast={noHit}
        >
          <cylinderGeometry args={[coreR * 0.7, coreR * 1.05, capH * 0.28, 7]} />
          {mat}
        </mesh>
      )}

      {/* Wet stone at the waterline. */}
      <mesh castShadow={false} receiveShadow position={[0, submerge - H / 2 + H * 0.02, 0]} raycast={noHit}>
        <cylinderGeometry args={[R * 1.03, R * 1.03, H * 0.04, 20]} />
        <meshStandardMaterial
          color={palette.monolith.clone().offsetHSL(0, 0.02, -0.16)}
          roughness={0.32}
          metalness={0}
          envMapIntensity={0.7}
          normalMap={normalMap}
          normalScale={normalScale}
        />
      </mesh>
    </group>
  )
}
