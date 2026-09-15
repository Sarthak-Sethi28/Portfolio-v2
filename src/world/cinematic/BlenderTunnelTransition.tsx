'use client'

import { useEffect, useRef } from 'react'
import {
  blenderTunnelActive,
  cinematicClock,
  cinematicDirection,
} from './cinematicState'
import { tunnelVideo } from './tunnelVideo'
import { useScene } from '@/store/scene'

/** Forward trip starts revealing through the aperture at this timeline point. */
const APERTURE_ON = 11.55
/** The render ends in black; clear it quickly onto the live world. */
const CLIP_CLEAR = 0.12
/** Forward-only: wait until the night composition is readable before PROJECTS. */
const TITLE_TRIGGER = 0.30

/**
 * One tunnel movie for both journeys.
 *
 * We deliberately play the authored clip FORWARD in both directions. Going
 * night -> day is still travelling forward through a gateway from the opposite
 * side; reversing the H.264 frames would make rings unnaturally suck backward
 * toward the viewer. The live world timeline reverses, but the passage itself
 * retains forward momentum.
 */
export function BlenderTunnelTransition() {
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)
  const video = useRef<HTMLVideoElement>(null)
  const started = useRef(false)
  const ended = useRef(false)
  const after = useRef(0)
  const titled = useRef(false)
  const lastDirection = useRef<1 | -1>(1)

  useEffect(() => {
    const el = video.current
    if (!el) return

    tunnelVideo.el = el
    let raf = 0
    let last = performance.now()

    const onEnded = () => {
      ended.current = true
      after.current = 0
      console.log(
        'TUNNEL END direction=',
        cinematicDirection.value,
        ' currentTime=',
        el.currentTime.toFixed(3),
      )
    }
    el.addEventListener('ended', onEnded)

    const resetForDirection = () => {
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
      const direction = cinematicDirection.value

      // A new trip in the opposite direction is the only time the player is
      // rewound. It is never restarted at the portal threshold itself.
      if (lastDirection.current !== direction) {
        lastDirection.current = direction
        resetForDirection()
      }

      if (!started.current) {
        const shouldStart = direction > 0 ? t >= APERTURE_ON : cinematicClock.running
        if (!shouldStart) return

        started.current = true
        blenderTunnelActive.value = true
        tunnelVideo.fullscreen = false
        tunnelVideo.aperture = true
        el.currentTime = 0
        el.style.opacity = '0'
        el.style.clipPath = 'ellipse(0px 0px at 50% 50%)'
        console.log('TUNNEL APERTURE START direction=', direction)

        void el.play().then(
          () => console.log('TUNNEL PLAYING direction=', direction),
          (err) => {
            console.log('TUNNEL BLOCKED', String(err))
            resetForDirection()
          },
        )
        return
      }

      // TunnelAperture owns the mask/opacity until the authored render ends.
      if (!ended.current) return

      after.current += dt
      el.style.opacity = String(Math.max(0, 1 - after.current / CLIP_CLEAR))

      if (after.current >= CLIP_CLEAR) {
        el.style.opacity = '0'
        el.style.clipPath = 'none'
        // Leave fullscreen latched for the rest of this trip. Otherwise the
        // aperture component could re-arm against the same timeline window.
        tunnelVideo.aperture = false
        blenderTunnelActive.value = false
      }

      // PROJECTS belongs only to the day -> night arrival. On the return trip
      // the title stays gone and the user's name returns naturally at day idle.
      if (
        direction > 0 &&
        after.current >= TITLE_TRIGGER &&
        !titled.current
      ) {
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
        filter: 'hue-rotate(-12deg) saturate(1.05) brightness(0.86) contrast(1.08)',
        willChange: 'clip-path, opacity',
      }}
    />
  )
}
