'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'

/**
 * Objective flicker measurement.
 *
 * "It is still flickering" and a locked 120fps cannot both be acted on without
 * turning the symptom into a number. Every frame this reads back a small block
 * of the composed framebuffer, computes its mean luminance, and tracks how much
 * that mean moves between consecutive frames.
 *
 * A stable image sits near zero. Anything that redraws differently each frame —
 * per-frame noise, crawling aliased edges, an unstable bloom on a sub-pixel
 * highlight — shows up as a spike, and the three sample regions say roughly
 * WHERE, which is the part guessing could never supply.
 *
 * readPixels stalls the pipeline, so this only runs behind ?flicker=1.
 */

const BLOCK = 24

export function FlickerProbe({ onSample }: { onSample: (deltas: number[]) => void }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  // A ref, not a memo: the probe accumulates across frames, and mutating a
  // value returned from useMemo is a React Compiler violation.
  const stateRef = useRef({
    buf: new Uint8Array(BLOCK * BLOCK * 4),
    last: [0, 0, 0],
    peak: [0, 0, 0],
    frames: 0,
  })

  useFrame(() => {
    const state = stateRef.current
    const ctx = gl.getContext()
    const dpr = gl.getPixelRatio()
    const w = Math.floor(size.width * dpr)
    const h = Math.floor(size.height * dpr)

    // Sky, the slab faces, and the mirrored plain — the three places an
    // artefact could plausibly live.
    const regions: [number, number][] = [
      [Math.floor(w * 0.5), Math.floor(h * 0.78)],
      [Math.floor(w * 0.18), Math.floor(h * 0.45)],
      [Math.floor(w * 0.5), Math.floor(h * 0.18)],
    ]

    regions.forEach(([x, y], i) => {
      ctx.readPixels(x, y, BLOCK, BLOCK, ctx.RGBA, ctx.UNSIGNED_BYTE, state.buf)
      let sum = 0
      for (let p = 0; p < state.buf.length; p += 4) {
        sum += 0.2126 * state.buf[p] + 0.7152 * state.buf[p + 1] + 0.0722 * state.buf[p + 2]
      }
      const mean = sum / (BLOCK * BLOCK)
      const delta = Math.abs(mean - state.last[i])
      // Ignore the first frames: shader compilation and texture upload make
      // the opening moments unrepresentative.
      if (state.frames > 30) state.peak[i] = Math.max(state.peak[i], delta)
      state.last[i] = mean
    })

    state.frames++
    if (state.frames % 30 === 0) onSample([...state.peak])
  })

  return null
}
