/**
 * The single <video> element behind both tunnel presentations.
 *
 * The clip is shown two ways — mapped onto a plane inside the portal's
 * aperture while the camera is still outside, then fullscreen once it has
 * crossed the ring. Both read THIS element, so the playback clock is shared by
 * construction rather than by synchronisation: there is only one currentTime in
 * existence, and a restart at the crossing is not something that can happen by
 * accident.
 *
 * Two separate elements kept in step would be the obvious alternative and the
 * wrong one — every frame of drift between them shows up exactly at the cut,
 * which is the one moment this has to be invisible.
 */
export const tunnelVideo = {
  el: null as HTMLVideoElement | null,
  /** True once the fullscreen layer has taken over from the aperture plane. */
  fullscreen: false,
  /** True while the aperture plane should be drawing the clip. */
  aperture: false,
}
