'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { LinearFilter, SRGBColorSpace, VideoTexture, type Mesh, type MeshBasicMaterial } from 'three'
import type { PerspectiveCamera } from 'three'
import { cinematicClock, portalFrame } from './cinematicState'
import { tunnelVideo } from './tunnelVideo'

/** When the tunnel becomes visible through the ring, seconds. */
/**
 * When the tunnel starts becoming visible through the ring, seconds.
 *
 * Earlier than the crossing by well over a second, because the portal has to
 * read as a WINDOW before the camera reaches it. Switched on instantly this
 * was a visible pop — a dark opening in one frame and a detailed tunnel in the
 * next — so it now comes up over a short ramp instead.
 */
const APERTURE_ON = 11.80
/**
 * How long the tunnel takes to resolve inside the aperture.
 *
 * Only the plane inside the ring fades; the exterior world and the portal are
 * untouched. A screen-wide fade would dim the whole approach, which is not
 * what is being revealed — the aperture is.
 */
const APERTURE_FADE = 0.55

/**
 * How far behind the aperture the video plane sits.
 *
 * This distance is the whole trick. The plane is sized so that it EXACTLY
 * fills the viewport when the camera reaches the portal's aperture — so at the
 * instant of the crossing, the in-world plane and a fullscreen presentation of
 * the same frame are the same image, at the same scale, on the same centre.
 * The handoff is then a swap between two identical pictures, which is why it
 * needs no crossfade and leaves nothing to notice.
 */
const PLANE_DEPTH = 60

/**
 * THE TUNNEL, SEEN THROUGH THE PORTAL.
 *
 * Previously the clip only existed as a fullscreen layer that appeared at the
 * crossing, which is why it read as two shots: an exterior, then a cut to an
 * interior. The fix is that there is no cut — the tunnel is already running
 * inside the ring while the camera is still outside it, and the ring's own
 * geometry is what the viewer's eye is following in.
 *
 * The plane sits BEHIND the portal, so the real ring occludes its edges and
 * does the masking. Nothing here draws a circle; the aperture is the portal's
 * actual opening.
 */
export function TunnelAperture() {
  const mesh = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)

  const texture = useMemo(() => {
    const el = tunnelVideo.el
    if (!el) return null
    const t = new VideoTexture(el)
    t.minFilter = LinearFilter
    t.magFilter = LinearFilter
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const g = mesh.current
    if (!g || !texture) return

    const t = cinematicClock.elapsed
    const c = portalFrame.centre

    /*
     * Visible from the moment the tunnel should be showing through the ring,
     * and switched off the instant the fullscreen layer takes over — never
     * both at once, or the plane would be seen edge-on as the camera passes
     * through it.
     */
    const on = t >= APERTURE_ON && !tunnelVideo.fullscreen
    g.visible = on
    tunnelVideo.aperture = on
    if (!on) return

    /*
     * The tunnel resolves INSIDE the aperture rather than appearing.
     *
     * Ramping the material's opacity leaves the ring, the ocean and the sky
     * exactly as they are and only brings up what is seen through the hole —
     * so the portal turns into a window rather than switching into one.
     */
    const mat = g.material as MeshBasicMaterial
    mat.opacity = Math.min(1, (t - APERTURE_ON) / APERTURE_FADE)

    g.position.set(c.x, c.y, c.z - PLANE_DEPTH)

    /*
     * Sized from the LIVE camera, every frame.
     *
     * The plane has to fill the viewport exactly at the crossing, and that
     * depends on the camera's current field of view and the window's aspect —
     * both of which change (the rig widens the lens on approach, and the user
     * can resize). Deriving it each frame is what keeps the two presentations
     * identical at the join under any of those conditions.
     */
    const vFov = (camera.fov * Math.PI) / 180
    const h = 2 * PLANE_DEPTH * Math.tan(vFov / 2)
    const w = h * (size.width / size.height)
    g.scale.set(w, h, 1)
  })
  /* eslint-enable react-hooks/immutability */

  if (!texture) return null

  return (
    <mesh ref={mesh} visible={false} renderOrder={-2}>
      <planeGeometry args={[1, 1]} />
      {/*
        Unlit and depth-writing: this is a rendered image, not a surface in the
        scene, so it must not take light from the world — and it must occlude
        the night ocean behind it, or the sea shows through the tunnel.
      */}
      <meshBasicMaterial map={texture} toneMapped={false} transparent opacity={0} />
    </mesh>
  )
}
