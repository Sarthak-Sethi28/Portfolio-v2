'use client'

import { useEffect, useRef } from 'react'
import { blenderTunnelActive, cinematicClock } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'
import { useScene } from '@/store/scene'

/** The tunnel starts running inside the ring, while the camera is still outside. */
const APERTURE_ON = 11.80
/** The camera reaches the portal face. Derived from the rig, not chosen. */
const CROSSING = 12.97

/**
 * How long the clip takes to clear.
 *
 * Short, and it OVERLAPS the night reveal rather than preceding it — see
 * below. Its final frames are near black, so what is crossfading is darkness
 * over darkness.
 */
const CLIP_CLEAR = 0.16
/**
 * How long the night world takes to come out of the dark.
 *
 * It begins the instant the clip starts clearing, not after. Holding black in
 * between is what produced a title card between the tunnel and the world.
 */
const NIGHT_REVEAL = 0.70
/**
 * When PROJECTS joins, as a fraction of the reveal.
 *
 * Late, so the word lands over a composition that is already readable. The
 * moon, the water and the portal resolve first simply because they are the
 * brightest things behind a lifting veil — that ordering comes for free and
 * does not need staging.
 */
const TITLE_AT = 0.62

/**
 * THE TUNNEL LAYER — one clip, two presentations, one clock.
 *
 * While the camera is outside, the clip is drawn on a plane inside the portal's
 * aperture by TunnelAperture, masked by the real ring. Once the camera crosses
 * the ring plane, this element takes over fullscreen. Both read the SAME video
 * element, so the changeover carries the exact playback position across — there
 * is no second clock to drift and nothing to restart.
 *
 * NO CROSSFADE AT THE ENTRY. The aperture plane is sized so that it fills the
 * viewport precisely at the crossing, which makes the two presentations the
 * same image at the same scale on the same centre. Blending identical pictures
 * achieves nothing and costs a frame of ghosting, so the swap is instant.
 *
 * THE ARRIVAL IS THE NIGHT WORLD, not a black page. The clip's black core
 * covers the handover while the live scene finishes settling into its night
 * state behind it; the darkness then lifts and the ocean, moon, pillars and
 * portal resolve out of it. Black is the cover, never the destination.
 */
export function BlenderTunnelTransition() {
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)
  const video = useRef<HTMLVideoElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const ended = useRef(false)
  const after = useRef(0)
  /*
   * Latched separately from `tunnelVideo.fullscreen`.
   *
   * That flag is cleared once the clip is done so the aperture plane can never
   * come back, which made the crossing condition true again on every
   * subsequent frame and re-ran the handoff — harmless to the picture, but it
   * spammed the continuity log hundreds of times and would have masked a real
   * second crossing if one ever occurred.
   */
  const crossed = useRef(false)
  const titled = useRef(false)

  useEffect(() => {
    const el = video.current
    if (!el) return
    tunnelVideo.el = el
    let raf = 0
    let last = performance.now()

    const onEnded = () => {
      ended.current = true
      console.log('TUNNEL END  currentTime=', el.currentTime.toFixed(3))
    }
    el.addEventListener('ended', onEnded)

    const reset = () => {
      started.current = false
      ended.current = false
      after.current = 0
      crossed.current = false
      titled.current = false
      tunnelVideo.fullscreen = false
      tunnelVideo.aperture = false
      blenderTunnelActive.value = false
      el.pause()
      el.currentTime = 0
      el.style.opacity = '0'
      if (veil.current) veil.current.style.opacity = '0'
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = cinematicClock.elapsed

      // A fresh run rewinds everything. The clock returning toward zero is the
      // only signal needed — no timer, no event, no extra state.
      if (t < APERTURE_ON - 0.5 && started.current) {
        reset()
        return
      }

      /*
       * Playback begins for the APERTURE, well before the crossing. By the
       * time the camera reaches the ring the tunnel has been running inside it
       * for most of a second, which is what removes any sense of the clip
       * "starting" at the threshold.
       */
      if (!started.current) {
        if (t < APERTURE_ON) return
        started.current = true
        blenderTunnelActive.value = true
        el.currentTime = 0
        console.log('TUNNEL APERTURE START')
        void el.play().then(
          () => undefined,
          (err) => {
            console.log('TUNNEL BLOCKED', String(err))
            reset()
          },
        )
        return
      }

      /*
       * THE SWAP. Instant, and at the same timestamp by construction.
       *
       * Logged either side so the continuity is verifiable rather than
       * asserted: the two readings are taken from one element, so they differ
       * only by the frame between them.
       */
      if (!crossed.current && t >= CROSSING) {
        const before = el.currentTime
        tunnelVideo.fullscreen = true
        el.style.opacity = '1'
        const afterT = el.currentTime
        console.log('PORTAL PLANE CROSSED  before=', before.toFixed(3))
        console.log('TUNNEL FULLSCREEN CONTINUITY  after=', afterT.toFixed(3),
                    ' delta=', (afterT - before).toFixed(3))
        crossed.current = true
      }

      if (!ended.current) {
        /*
         * The night world is brought up UNDER the clip before it finishes.
         *
         * The live scene has already completed its own timeline by now — night
         * has landed and the camera is back at the destination pose — so what
         * is waiting behind the video is the real night ocean, not the day
         * world and not an empty page. The veil is raised while the render's
         * own black core still covers everything, so the changeover happens
         * inside darkness.
         */
        const dur = el.duration || 3
        if (veil.current && el.currentTime > dur - 0.30) {
          const lead = (el.currentTime - (dur - 0.30)) / 0.30
          veil.current.style.opacity = String(Math.min(1, lead))
        }
        return
      }

      after.current += dt

      /*
       * THE CLIP CLEARS AND THE NIGHT COMES UP TOGETHER.
       *
       * Previously the video faded onto a HELD black veil and only then did
       * the world appear, which read as three separate states: tunnel, black
       * card, night. There is no hold now — the veil begins lifting on the
       * same frame the clip begins clearing, so the darkness at the end of the
       * tunnel simply becomes the darkness the world emerges from.
       */
      el.style.opacity = String(Math.max(0, 1 - after.current / CLIP_CLEAR))
      if (after.current >= CLIP_CLEAR) {
        el.style.opacity = '0'
        tunnelVideo.fullscreen = false
      }

      /*
       * The moon reads first, then the water, then the portal — not because
       * they are staged in that order but because that is what happens when a
       * black veil lifts off a scene: the brightest things emerge first. The
       * ordering is free; only its speed needed choosing.
       */
      const r = Math.min(1, after.current / NIGHT_REVEAL)
      const eased = r * r * (3 - 2 * r)
      if (veil.current) veil.current.style.opacity = String(1 - eased)

      // PROJECTS lands over a night composition that already reads.
      if (r >= TITLE_AT && !titled.current) {
        titled.current = true
        setArrivedTitle(true)
        console.log('PROJECTS SHOWN')
      }

      if (r >= 1 && blenderTunnelActive.value) {
        blenderTunnelActive.value = false
        console.log('NIGHT REVEAL complete')
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('ended', onEnded)
      tunnelVideo.el = null
      tunnelVideo.fullscreen = false
      blenderTunnelActive.value = false
    }
  }, [setArrivedTitle])

  return (
    <>
      {/*
        The transition cover: black, above the canvas, below the title. It is
        raised under the clip and lifted to reveal the night world — never the
        destination itself.
      */}
      <div
        ref={veil}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#010204',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
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
          pointerEvents: 'none',
          zIndex: 9999,
          background: '#000',
        }}
      />
    </>
  )
}
