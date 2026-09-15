'use client'

import { useEffect, useRef } from 'react'
import { blenderTunnelActive, cinematicClock } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'
import { useScene } from '@/store/scene'

/** Same moment used by TunnelAperture. Playback starts before the portal crossing. */
const APERTURE_ON = 11.55
/** The render ends in black; clear it quickly onto the timeline's own blackout. */
const CLIP_CLEAR = 0.20
/** PROJECTS starts its CSS reveal only after the night world has begun to emerge. */
const TITLE_TRIGGER = 0.10

/**
 * The single tunnel video element for the entire journey.
 *
 * Entry continuity is no longer a swap between a VideoTexture plane and a DOM
 * video. TunnelAperture clips THIS element to the projected portal opening, then
 * removes that mask only when it already covers the viewport. The element never
 * restarts, rescales, changes object-fit or changes crop.
 *
 * Exit continuity uses the existing R3F blackout that already hides the camera
 * handback. The Blender render's black core fades directly onto that black, and
 * the timeline then reveals the real night ocean / moon / pillars / red portal.
 * There is no second DOM black card between the tunnel and the destination.
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
        tunnelVideo.fullscreen = false
        tunnelVideo.aperture = false
        blenderTunnelActive.value = false
      }

      /*
       * The timeline's camera-attached blackout is already falling away here,
       * so the real night world is resolving underneath the black Blender core.
       * Title.tsx adds its own short delay; triggering here places PROJECTS over
       * a readable destination instead of on a separate black title card.
       */
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
      }}
    />
  )
}
