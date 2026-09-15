/**
 * Shared imperative state for the single tunnel <video> element.
 *
 * The video now has exactly one visual presentation: a fixed, full-viewport DOM
 * element. Before the camera crosses the portal, TunnelAperture clips that same
 * element to the portal opening projected into screen space. When the opening
 * covers the viewport the clip-path is removed. Nothing restarts, rescales or
 * swaps renderers at the threshold, so currentTime, crop and pixels remain
 * continuous by construction.
 */
export const tunnelVideo = {
  el: null as HTMLVideoElement | null,
  /** True once the aperture mask has been removed. */
  fullscreen: false,
  /** True while the fixed video is being revealed through the projected opening. */
  aperture: false,
}
