'use client'

import { useEffect, useRef, useState } from 'react'
import { useScene } from '@/store/scene'

/**
 * Frame-rate and capability readout, shown only with ?stats=1.
 *
 * Exists because "it's lagging" and "it looks black" are not numbers, and the
 * machine that matters is never the one the code was written on. It has
 * already earned its keep: it disproved a theory that the water was black
 * because the quality tier had dropped to low.
 *
 * The panel is always rendered with identical initial markup on server and
 * client — visibility and measurement are decided in an effect. Reading the
 * URL during render instead would hydrate differently every time.
 */
export function Stats() {
  const quality = useScene((s) => s.quality)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const ref = useRef<HTMLDivElement>(null)
  const [fps, setFps] = useState(0)
  const [low, setLow] = useState(0)
  // Written straight into the DOM rather than held in state: it is queried
  // once and never changes, and setting state synchronously in an effect
  // cascades a render for no benefit.
  const gpuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).has('stats')
    if (ref.current) ref.current.hidden = !enabled
    if (!enabled) return

    let gpu = 'unavailable'
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      gpu = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown'
    } catch {
      // keep the fallback
    }
    if (gpuRef.current) gpuRef.current.textContent = `gpu :: ${gpu}`

    let frames = 0
    let last = performance.now()
    let worst = Number.POSITIVE_INFINITY
    let raf = 0

    const tick = () => {
      frames++
      const now = performance.now()
      if (now - last >= 500) {
        const current = Math.round((frames * 1000) / (now - last))
        setFps(current)
        // Ignore the first samples: shader compilation and texture upload make
        // the opening second unrepresentative of steady state.
        if (now > 3000) {
          worst = Math.min(worst, current)
          setLow(worst)
        }
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const colour = fps >= 55 ? '#7ee787' : fps >= 30 ? '#e3b341' : '#ff7b72'

  return (
    <div
      ref={ref}
      hidden
      className="pointer-events-none fixed left-3 top-3 z-50 rounded border px-3 py-2 text-[11px] leading-relaxed"
      style={{
        fontFamily: 'var(--font-mono), monospace',
        background: 'rgba(0,0,0,0.62)',
        borderColor: 'rgba(255,255,255,0.14)',
        color: 'rgba(235,235,230,0.82)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ color: colour }}>
        {fps} fps <span style={{ opacity: 0.6 }}>(low {low || '—'})</span>
      </div>
      <div>tier :: {quality.tier}</div>
      <div>reflector :: {quality.reflectorResolution || 'off'}</div>
      <div>dpr cap :: {quality.maxDpr}</div>
      <div>reduced-motion :: {reducedMotion ? 'yes' : 'no'}</div>
      <div ref={gpuRef} style={{ maxWidth: 260, opacity: 0.65 }}>
        gpu :: —
      </div>
    </div>
  )
}
