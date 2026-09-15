'use client'

import { useEffect, useRef } from 'react'
import { blenderTunnelActive, cinematicClock } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'
import { useScene } from '@/store/scene'

/** Same moment used by TunnelAperture. Playback starts before the portal crossing. */
const APERTURE_ON = 11.55
/** The render ends in black; clear it quickly onto the timeline's own blackout. */
const CLIP_CLEAR = 0.12
/** PROJECTS begins only once the night world has had time to emerge from black. */
const TITLE_TRIGGER = 0.16

/**
 * The single tunnel video element for the entire journey.
 *
 * Entry continuity is one image: TunnelAperture clips this exact element to the
 * projected portal opening, then removes only that mask once the aperture covers
 * the viewport. There is no second player, crop, scale, restart or crossfade.
 *
 * Exit continuity uses the R3F blackout that already hides the destination
 * camera handback. The Blender core and that blackout overlap for only a short
 * beat, then the actual night ocean resolves underneath.
 */
export function BlenderTunnelTransition() {
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)
  const video = useRef<HTMLVideoElement>(null)
  const started = useRef(false)
  const ended = useRef(false)
  const after = useRef(0)
  const titled = useRef(false)

  useEffect(() => {
    const el = video.current
    if (!el) return

    tunnelVideo.el = el
    let raf = 0
    let last = performance.now()

    const onEnded = () => {
      ended.current = true
      after.current = 0
      console.log('TUNNEL END  currentTime=', el.currentTime.toFixed(3))
    }
    el.addEventListener('ended', onEnded)

    const reset = () => {
      started.current = false
      ended.current = false
      after.current = 0
      titled.current = false
      tunnelVideo.fullscreen = false
      tunnelVideo.aperture = false
      blenderTunnelActive.value = false
      el.pause()
      el.currentTime = 0
      el.style.opacity = '0'
      el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = cinematicClock.elapsed

      // A fresh F run rewinds the same element and the same mask state.
      if (t < APERTURE_ON - 0.5 && started.current) {
        reset()
        return
      }

      if (!started.current) {
        if (t < APERTURE_ON) return

        started.current = true
        blenderTunnelActive.value = true
        tunnelVideo.fullscreen = false
        tunnelVideo.aperture = true
        el.currentTime = 0
        el.style.opacity = '0'
        el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
        console.log('TUNNEL APERTURE START')

        void el.play().then(
          () => console.log('TUNNEL PLAYING'),
          (err) => {
            console.log('TUNNEL BLOCKED', String(err))
            reset()
          },
        )
        return
      }

      // TunnelAperture owns the live mask/opacity until the clip ends. Once the
      // render has ended, this component alone owns the fade into the night.
      if (!ended.current) return

      after.current += dt
      el.style.opacity = String(Math.max(0, 1 - after.current / CLIP_CLEAR))

      if (after.current >= CLIP_CLEAR) {
        el.style.opacity = '0'
        el.style.clipPath = 'none'
        // Keep fullscreen latched until the next run so TunnelAperture cannot
        // re-arm itself while the master clock is still past the entry window.
        tunnelVideo.aperture = false
        blenderTunnelActive.value = false
      }

      if (after.current >= TITLE_TRIGGER && !titled.current) {
        titled.current = true
        setArrivedTitle(true)
        console.log('PROJECTS SHOWN')
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('ended', onEnded)
      tunnelVideo.el = null
      tunnelVideo.fullscreen = false
      tunnelVideo.aperture = false
      blenderTunnelActive.value = false
    }
  }, [setArrivedTitle])

  return (
    <video
      ref={video}
      src="/cinematic/tunnel-move.mp4"
      muted
      playsInline
      preload="auto"
      crossOrigin="anonymous"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        opacity: 0,
        clipPath: 'ellipse(0px 0px at 50% 50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        background: '#000',
        /*
         * The Blender beauty render was a little warmer/brighter than the live
         * portal in final-run(8). A restrained transit-only grade pulls orange
         * toward crimson and lowers the hot walls without touching the signed-
         * off day/night world or the site's global tone mapping.
         */
        filter: 'hue-rotate(-12deg) saturate(1.05) brightness(0.86) contrast(1.08)',
        willChange: 'clip-path, opacity',
      }}
    />
  )
}
