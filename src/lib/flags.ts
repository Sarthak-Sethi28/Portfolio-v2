/**
 * URL debug flags, for bisecting a visual artefact.
 *
 * Added because "it is still flickering" plus a locked 120fps is not enough
 * information to fix anything, and guessing at candidates one deploy at a time
 * is slow and disrespectful of the person doing the looking. Each flag
 * disables exactly one animated or post-processed subsystem, so whoever is in
 * front of the screen can bisect the cause in a couple of reloads.
 *
 * ?still     freeze the camera completely
 * ?nobloom   disable bloom
 * ?nomotes   disable the drifting dust
 * ?noreflect disable the water reflection
 * ?nopost    disable ALL post-processing
 * ?plain     all of the above at once
 */
export interface Flags {
  still: boolean
  noBloom: boolean
  noMotes: boolean
  noReflect: boolean
  noPost: boolean
  /** Run the frame-to-frame luminance probe. Costs a pipeline stall. */
  probe: boolean
  /** Drop the concrete surface map — isolates texture shimmer from edge crawl. */
  noTex: boolean
}

const EMPTY: Flags = {
  still: false,
  noBloom: false,
  noMotes: false,
  noReflect: false,
  noPost: false,
  probe: false,
  noTex: false,
}

export function readFlags(): Flags {
  if (typeof window === 'undefined') return EMPTY
  const q = new URLSearchParams(window.location.search)
  const plain = q.has('plain')
  return {
    still: plain || q.has('still'),
    noBloom: plain || q.has('nobloom'),
    noMotes: plain || q.has('nomotes'),
    noReflect: plain || q.has('noreflect'),
    noPost: plain || q.has('nopost'),
    probe: q.has('flicker'),
    noTex: plain || q.has('notex'),
  }
}
