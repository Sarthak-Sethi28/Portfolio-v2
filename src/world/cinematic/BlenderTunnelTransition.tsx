'use client'

import { useEffect, useRef } from 'react'
import {
  blenderTunnelActive,
  cinematicClock,
  cinematicDirection,
  returnJourney,
  setCinematicTime,
  RETURN_VIDEO_ON,
} from './cinematicState'
import { tunnelVideo } from './tunnelVideo'
import { useScene } from '@/store/scene'

const APERTURE_ON = 11.55
const CLIP_CLEAR = 0.12
const TITLE_TRIGGER = 0.30

/**
 * One authored tunnel movie for both journeys, always played FORWARD.
 *
 * The return no longer rewinds the exterior world after the movie. When the
 * black core reaches us on the return trip, DAY + the home camera are restored
 * underneath that fully opaque frame, then the same video simply clears away.
 */
export function BlenderTunnelTransition() {
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)
  const setNight = useScene((s) => s.setNight)
  const setCinematic = useScene((s) => s.setCinematic)
  const worldUp = useScene((s) => s.phase) !== 'booting'
  const video = useRef<HTMLVideoElement>(null)
  const started = useRef(false)
  const ended = useRef(false)
  const after = useRef(0)
  const titled = useRef(false)
  const lastDirection = useRef<1 | -1>(1)

  /*
   * Fetch the tunnel only once the world it sits over actually exists.
   *
   * Eleven seconds of exterior have to play before this file is needed, so it
   * has no business competing with the pillars and the portal for the first
   * second of a cold load. Starting it here still leaves it many seconds of
   * head start over any plausible press of F.
   */
  useEffect(() => {
    const el = video.current
    if (!el || !worldUp) return
    el.preload = 'auto'
    el.load()
  }, [worldUp])

  useEffect(() => {
    const el = video.current
    if (!el) return

    tunnelVideo.el = el
    let raf = 0
    let last = performance.now()

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

    const onEnded = () => {
      ended.current = true
      after.current = 0

      if (cinematicDirection.value < 0) {
        returnJourney.active = false
        returnJourney.elapsed = 0
        setCinematicTime(0)
        setNight(false)
        setArrivedTitle(false)
      }

      console.log(
        'TUNNEL END direction=',
        cinematicDirection.value,
        ' currentTime=',
        el.currentTime.toFixed(3),
      )
    }
    el.addEventListener('ended', onEnded)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const direction = cinematicDirection.value

      if (lastDirection.current !== direction) {
        lastDirection.current = direction
        resetForDirection()
      }

      if (!started.current) {
        const shouldStart =
          direction > 0
            ? cinematicClock.elapsed >= APERTURE_ON
            : returnJourney.active && returnJourney.elapsed >= RETURN_VIDEO_ON

        if (!shouldStart) return

        started.current = true
        ended.current = false
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

      if (!ended.current) return

      after.current += dt
      el.style.opacity = String(Math.max(0, 1 - after.current / CLIP_CLEAR))

      if (after.current >= CLIP_CLEAR) {
        el.style.opacity = '0'
        el.style.clipPath = 'none'
        tunnelVideo.aperture = false
        blenderTunnelActive.value = false

        if (direction < 0) {
          tunnelVideo.fullscreen = false
          cinematicClock.running = false
          setCinematic('idle')
        }
      }

      if (direction > 0 && after.current >= TITLE_TRIGGER && !titled.current) {
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
  }, [setArrivedTitle, setNight, setCinematic])

  return (
    <video
      ref={video}
      src="/cinematic/tunnel-move-master.mp4"
      muted
      playsInline
      /*
       * NOT preload="auto".
       *
       * At 2560x1440 this file is 4.2MB, and with preload="auto" the browser
       * asked for it 63ms into a cold load — ahead of every pillar, texture and
       * the portal itself, on the same origin and against the same connection
       * budget. It is needed eleven seconds later at the earliest. The fetch is
       * started by hand once the world is up; see the effect above.
       */
      preload="none"
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
