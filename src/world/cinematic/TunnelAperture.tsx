'use client'

import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock, portalFrame } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'

/** Start the SAME fullscreen video while it is still only visible through the portal hole. */
const APERTURE_ON = 11.55
/** Resolve the tunnel gently inside the aperture; the exterior never fades. */
const APERTURE_FADE = 0.48
/**
 * Measured from portal_final.glb: inner opening radius / authored outer radius.
 * Keeping a tiny inset prevents the DOM layer from painting over the metal lip.
 */
const INNER_RADIUS_RATIO = 0.555
const MASK_INSET = 0.985
const RIGHT = new Vector3(1, 0, 0)
const UP = new Vector3(0, 1, 0)

function smooth01(x: number): number {
  const v = Math.max(0, Math.min(1, x))
  return v * v * (3 - 2 * v)
}

function ellipseCoversViewport(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  height: number,
): boolean {
  if (rx <= 0 || ry <= 0) return false
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ]
  return corners.every(([x, y]) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1
  })
}

/**
 * ONE-IMAGE portal entry.
 *
 * There is no 3D video plane any more. A plane and a fixed DOM video can share
 * currentTime and still disagree spatially because one is perspective-projected
 * and the other is object-fit: cover. That tiny scale reset was the visible
 * "join" in final-run(7).
 *
 * Instead the one fixed video element is present for the entire passage. While
 * the camera is outside, this component clips that exact element to the real
 * portal opening projected into CSS pixels. As the camera advances, the mask
 * naturally grows with the ring. Once the ellipse covers every viewport corner
 * the mask is removed. The pixels, crop, scale and playback clock do not change
 * on that frame, so there is literally no second presentation to cut to.
 */
export function TunnelAperture() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)

  const scratch = useMemo(
    () => ({
      centre: new Vector3(),
      left: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      down: new Vector3(),
      cameraDelta: new Vector3(),
    }),
    [],
  )

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const el = tunnelVideo.el
    if (!el || !portalFrame.measured) return

    const t = cinematicClock.elapsed

    if (t < APERTURE_ON) {
      if (!tunnelVideo.fullscreen) {
        tunnelVideo.aperture = false
        el.style.opacity = '0'
        el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
      }
      return
    }

    // Once the mask has been removed, never touch opacity again. The transition
    // component owns the final fade into the night destination after `ended`.
    if (tunnelVideo.fullscreen) return

    const c = portalFrame.centre
    const r = portalFrame.radius * INNER_RADIUS_RATIO * MASK_INSET

    scratch.centre.copy(c).project(camera)
    scratch.left.copy(c).addScaledVector(RIGHT, -r).project(camera)
    scratch.right.copy(c).addScaledVector(RIGHT, r).project(camera)
    scratch.up.copy(c).addScaledVector(UP, r).project(camera)
    scratch.down.copy(c).addScaledVector(UP, -r).project(camera)

    const cx = (scratch.centre.x * 0.5 + 0.5) * size.width
    const cy = (0.5 - scratch.centre.y * 0.5) * size.height
    const leftX = (scratch.left.x * 0.5 + 0.5) * size.width
    const rightX = (scratch.right.x * 0.5 + 0.5) * size.width
    const upY = (0.5 - scratch.up.y * 0.5) * size.height
    const downY = (0.5 - scratch.down.y * 0.5) * size.height

    const rx = Math.max(Math.abs(cx - leftX), Math.abs(rightX - cx))
    const ry = Math.max(Math.abs(cy - upY), Math.abs(downY - cy))

    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 1 || ry < 1) return

    const alpha = smooth01((t - APERTURE_ON) / APERTURE_FADE)
    tunnelVideo.aperture = true
    el.style.opacity = String(alpha)
    el.style.clipPath = `ellipse(${rx.toFixed(2)}px ${ry.toFixed(2)}px at ${cx.toFixed(2)}px ${cy.toFixed(2)}px)`

    /*
     * The important handoff is no handoff at all: only remove the mask once the
     * masked video already covers the whole viewport. Clearing clip-path then
     * changes zero visible pixels. If projection becomes singular right at the
     * threshold, the geometric plane-crossing is the fallback: once the camera
     * is physically behind the aperture there is no exterior ring left to hide.
     */
    const signedDistance = scratch.cameraDelta
      .copy(camera.position)
      .sub(c)
      .dot(portalFrame.axis)
    if (ellipseCoversViewport(cx, cy, rx, ry, size.width, size.height) || signedDistance <= 0) {
      tunnelVideo.aperture = false
      tunnelVideo.fullscreen = true
      el.style.clipPath = 'none'
      el.style.opacity = '1'
      console.log('TUNNEL MASK CLEARED  currentTime=', el.currentTime.toFixed(3))
    }
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
