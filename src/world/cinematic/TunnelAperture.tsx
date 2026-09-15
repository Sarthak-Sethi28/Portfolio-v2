'use client'

import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock, portalFrame } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'

/** Start the SAME fullscreen video while it is still only visible through the portal hole. */
const APERTURE_ON = 11.55
/**
 * Give the eye time to discover detail inside the black aperture instead of
 * watching a rendered movie suddenly switch on. The exterior itself never fades.
 */
const APERTURE_FADE = 0.82
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
 * There is no 3D video plane. The one fixed tunnel video exists for the whole
 * passage and is clipped to the real portal opening while the camera is outside.
 * As the camera advances, the mask grows with the projected aperture. Only after
 * the ellipse already covers every viewport corner is the mask removed, so the
 * handoff cannot expose even a single new pixel.
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

    /*
     * Slower at the beginning than an ordinary smoothstep. Tiny high-frequency
     * tunnel details therefore rise out of the portal black instead of popping
     * into it, while the last half of the reveal still reaches full strength
     * comfortably before the camera crosses the ring.
     */
    const reveal = smooth01((t - APERTURE_ON) / APERTURE_FADE)
    const alpha = Math.pow(reveal, 1.35)
    tunnelVideo.aperture = true
    el.style.opacity = String(alpha)
    el.style.clipPath = `ellipse(${rx.toFixed(2)}px ${ry.toFixed(2)}px at ${cx.toFixed(2)}px ${cy.toFixed(2)}px)`

    /*
     * Do NOT use the portal-plane crossing as a fallback. In final-run(8) that
     * could clear the mask a few frames before the opening covered the screen,
     * revealing the corners and making the grade change read like a cut. We wait
     * for the projected opening itself to cover every corner; clearing clip-path
     * on that frame changes zero visible pixels.
     */
    if (ellipseCoversViewport(cx, cy, rx, ry, size.width, size.height)) {
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
