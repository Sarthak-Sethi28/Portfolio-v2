'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import {
  cinematicClock,
  cinematicDirection,
  DURATION,
  portalFrame,
} from './cinematicState'
import { tunnelVideo } from './tunnelVideo'

/** Forward trip: tunnel starts resolving through the real opening here. */
const APERTURE_ON = 11.55
const APERTURE_FADE = 0.82
/**
 * Reverse trip must be fully covered BEFORE the live reverse camera leaves its
 * held night pose at ~14.46. Starting at 15, 0.42s gives us that safety margin.
 */
const REVERSE_ENTER = 0.42
const REVERSE_REVEAL = 0.24

/** Measured inner opening / authored outer radius. */
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

function coverScale(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  height: number,
): number {
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ]
  let need = 1
  for (const [x, y] of corners) {
    const dx = (x - cx) / Math.max(rx, 1)
    const dy = (y - cy) / Math.max(ry, 1)
    need = Math.max(need, Math.sqrt(dx * dx + dy * dy))
  }
  return need * 1.025
}

/**
 * ONE VIDEO, ONE MASK, BOTH DIRECTIONS.
 *
 * Day -> night uses the real projected opening, exactly as the locked forward
 * transition does now.
 *
 * Night -> day starts from the held night composition, latches that portal's
 * on-screen ellipse, then expands ONLY THE MASK until it covers the viewport.
 * The video itself never scales or restarts. This hides the reverse camera's
 * internal handback while still reading as physically entering the same ring.
 */
export function TunnelAperture() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)

  const reverseMask = useRef<{
    cx: number
    cy: number
    rx: number
    ry: number
    cover: number
  } | null>(null)
  const lastDirection = useRef<1 | -1>(1)

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
    const direction = cinematicDirection.value

    if (lastDirection.current !== direction) {
      lastDirection.current = direction
      reverseMask.current = null
    }

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

    if (direction > 0) {
      if (t < APERTURE_ON) {
        tunnelVideo.aperture = false
        el.style.opacity = '0'
        el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
        return
      }

      const reveal = smooth01((t - APERTURE_ON) / APERTURE_FADE)
      const alpha = Math.pow(reveal, 1.35)
      tunnelVideo.aperture = true
      el.style.opacity = String(alpha)
      el.style.clipPath = `ellipse(${rx.toFixed(2)}px ${ry.toFixed(2)}px at ${cx.toFixed(2)}px ${cy.toFixed(2)}px)`

      if (ellipseCoversViewport(cx, cy, rx, ry, size.width, size.height)) {
        tunnelVideo.aperture = false
        tunnelVideo.fullscreen = true
        el.style.clipPath = 'none'
        el.style.opacity = '1'
        console.log('TUNNEL MASK CLEARED forward  currentTime=', el.currentTime.toFixed(3))
      }
      return
    }

    // NIGHT -> DAY. Latch the night portal before the hidden reverse camera
    // starts retracing the forward rig. From here the mask has its own clean,
    // monotonic expansion; the underlying camera is free to move invisibly.
    if (!reverseMask.current) {
      reverseMask.current = {
        cx,
        cy,
        rx,
        ry,
        cover: coverScale(cx, cy, rx, ry, size.width, size.height),
      }
    }

    const m = reverseMask.current
    const elapsedBack = DURATION - t
    const open = smooth01(elapsedBack / REVERSE_ENTER)
    const alpha = smooth01(elapsedBack / REVERSE_REVEAL)
    const scale = 1 + (m.cover - 1) * open
    const erx = m.rx * scale
    const ery = m.ry * scale

    tunnelVideo.aperture = true
    el.style.opacity = String(alpha)
    el.style.clipPath = `ellipse(${erx.toFixed(2)}px ${ery.toFixed(2)}px at ${m.cx.toFixed(2)}px ${m.cy.toFixed(2)}px)`

    if (open >= 0.999 || ellipseCoversViewport(m.cx, m.cy, erx, ery, size.width, size.height)) {
      tunnelVideo.aperture = false
      tunnelVideo.fullscreen = true
      el.style.clipPath = 'none'
      el.style.opacity = '1'
      console.log('TUNNEL MASK CLEARED reverse  currentTime=', el.currentTime.toFixed(3))
    }
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
