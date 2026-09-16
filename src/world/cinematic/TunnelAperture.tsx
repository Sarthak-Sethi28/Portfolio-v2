'use client'

import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import {
  cinematicClock,
  cinematicDirection,
  portalFrame,
  returnJourney,
  RETURN_APERTURE_FADE,
  RETURN_VIDEO_ON,
} from './cinematicState'
import { tunnelVideo } from './tunnelVideo'

/*
 * Brought forward for the faster forward clock.
 *
 * This is a position on the AUTHORED timeline, but the video it starts is three
 * real seconds long whatever the timeline is doing. Running the journey at 2.2x
 * left only 0.56s of tunnel visible inside the ring before the crossing,
 * against the return's 1.21 — the two directions had drifted apart again. Ten
 * and a bit puts the reveal back at roughly the same real-time distance ahead
 * of the crossing as the return has.
 */
const APERTURE_ON = 10.2
const APERTURE_FADE = 0.82
// Both directions now bring the tunnel into the ring 0.80s after the push
// begins, over the same fade. The return used to do it in 0.50s from a
// standstill, which is most of why it felt hurried.
const RETURN_APERTURE_ON = RETURN_VIDEO_ON

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
 * The same fixed video is visible through the REAL projected portal opening in
 * both directions. The return no longer fakes entry by scaling a DOM ellipse;
 * the live camera actually flies toward the ring, so the mask grows because the
 * aperture grows in perspective. Once it covers every corner we simply remove
 * the clip-path — no restart, crop change, zoom or crossfade.
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
    if (!el || !portalFrame.measured || tunnelVideo.fullscreen) return

    const direction = cinematicDirection.value
    const revealTime = direction > 0 ? cinematicClock.elapsed - APERTURE_ON : returnJourney.elapsed - RETURN_APERTURE_ON
    const fadeTime = direction > 0 ? APERTURE_FADE : RETURN_APERTURE_FADE

    if (revealTime < 0) {
      tunnelVideo.aperture = false
      el.style.opacity = '0'
      el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
      return
    }

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

    const reveal = smooth01(revealTime / fadeTime)
    const alpha = direction > 0 ? Math.pow(reveal, 1.35) : Math.pow(reveal, 1.18)

    tunnelVideo.aperture = true
    el.style.opacity = String(alpha)
    el.style.clipPath = `ellipse(${rx.toFixed(2)}px ${ry.toFixed(2)}px at ${cx.toFixed(2)}px ${cy.toFixed(2)}px)`

    if (ellipseCoversViewport(cx, cy, rx, ry, size.width, size.height)) {
      tunnelVideo.aperture = false
      tunnelVideo.fullscreen = true
      el.style.clipPath = 'none'
      el.style.opacity = '1'
      console.log(
        direction > 0 ? 'TUNNEL MASK CLEARED forward' : 'TUNNEL MASK CLEARED return',
        ' currentTime=',
        el.currentTime.toFixed(3),
      )
    }
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
