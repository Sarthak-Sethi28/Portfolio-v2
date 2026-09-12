'use client'

import { useMemo } from 'react'
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { RepeatWrapping, Vector2, type Texture } from 'three'
import type { Palette } from '../atmosphere/palette'

/**
 * The salt plain: a centimetre of standing water over a flat bed.
 *
 * The surface normals come from a PHOTOGRAPH of water, converted to a normal
 * map offline (scripts/make-water-normal.mjs). A sum of sine waves cannot
 * produce what the eye actually looks for — ripples of varying length crossing
 * at inconsistent angles, never repeating. Every procedural field eventually
 * betrays its period, and at this scale it showed as corduroy.
 *
 * The field drifts continuously, so the surface is never the same twice.
 *
 * PLAIN repeat wrapping, not mirrored.
 *
 * Mirroring is seamless by construction, but it makes every tile a reflection
 * of its neighbour — and that symmetry reads as a hard grid across the
 * surface, kaleidoscoping about each boundary. The source is already made
 * seamless by cross-fading opposite edges into each other
 * (scripts/make-water-normal.mjs), so it can simply repeat, and a repeat has
 * no symmetry for the eye to latch onto.
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

  const base = useTexture('/water-normal.jpg', (t) => {
    const tex = (Array.isArray(t) ? t[0] : t) as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.anisotropy = maxAniso
  }) as Texture

  // Independent clones so each can carry its own tiling and drift.
  const coarse = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(22, 22)
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [base, maxAniso])

  // Rain does not distort the reflection any more; it raises the surface's
  // own slope instead, which is both physically truer and cannot sample out
  // of bounds.
  const amp = 0.5 + distort * 0.9
  const normalScale = useMemo(() => new Vector2(amp, amp), [amp])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    coarse.offset.set(t * 0.0075, t * 0.0046)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          blur={[30, 9]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          // Lower, deliberately.
          //
          // At 6 the surface's brightness came almost entirely from the
          // reflection pass — a second full render of the scene, every frame.
          // Miss that pass once and the water loses most of its light: a
          // single dark frame confined to the lower third, which is precisely
          // what a frame-by-frame analysis of a screen recording found (three
          // dips of 12-15%, none anywhere else in the frame).
          //
          // With the environment map carrying more of the load, a late
          // reflection is a small change rather than a blackout.
          mixStrength={2.6}
          roughness={roughness}
          depthScale={0}
          color={palette.waterTint}
          metalness={1}
          mirror={1}
          // NO distortion map.
          //
          // distortion offsets where the reflection is sampled from. At this
          // tiling it pushed samples outside the reflection buffer, which
          // returns black — a scatter of dark dashes across the plain, in a
          // regular pattern because the offsets come from a tiled texture.
          // Reducing it only made them fainter.
          //
          // It is not needed: the normal map already breaks the surface up,
          // and it does so by changing the SHADING, which cannot sample
          // anything out of bounds.
          normalMap={coarse}
          normalScale={normalScale}
          // The sky is reflected from the environment map regardless of the
          // reflection pass, so the surface always has light of its own.
          envMapIntensity={1.35}
          reflectorOffset={0}
        />
      ) : (
        <meshStandardMaterial
          color={palette.waterTint}
          roughness={Math.max(roughness, 0.35)}
          metalness={0.6}
          normalMap={coarse}
          normalScale={normalScale}
        />
      )}
    </mesh>
  )
}
