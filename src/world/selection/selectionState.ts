'use client'

import type { SectionId } from '@/content'

/**
 * Selection facts the frame loop needs, kept outside React.
 *
 * Hover and click are discrete events, so they live in the zustand store where
 * the DOM overlay can read them. What must NOT live there is anything sampled
 * per frame: the same lesson as the cinematic's night blend, which used to
 * re-render both worlds fifty times during a transition. The store publishes
 * intent here once per change; the rigs read it sixty times a second.
 */
export const pillarSelection = {
  /** The section whose pillar is currently raised, or null. */
  selected: null as SectionId | null,
  /** Where that pillar stands, so the camera can frame it without a lookup. */
  centre: [0, 0, 0] as [number, number, number],
  /** 0 at rest, 1 fully reframed. Written by SelectionRig, read by nobody else. */
  reframe: 0,
}

/** True while the selection rig is easing or holding the framing. */
export const selectionCameraActive = { value: false }

/**
 * How far a chosen pillar rises, in world units.
 *
 * Bounded by the waterline, not by how dramatic it could be. These columns are
 * modelled standing on a photogrammetry plinth that the scene deliberately
 * sinks below the surface; lift one far enough and that flat slab comes up with
 * it and the monument reads as furniture on a table. Three units is the most
 * that keeps the shaft genuinely cut by the water — which is what makes the
 * move look like the sea giving something up rather than an object levitating.
 */
export const PILLAR_RISE = 3.0

/**
 * Which half of the screen the panel takes.
 *
 * The answer is always "the half the column is not in". Pinning the panel to
 * one side put the content directly on top of the very object it describes for
 * two of the four columns, which is the one thing this layout cannot do — the
 * whole point is that you can see what you selected.
 *
 * Derived from the column's world x, which is also what the camera reads, so
 * the two cannot disagree about which side is free.
 */
export function panelSideFor(x: number): 'left' | 'right' {
  return x >= 0 ? 'left' : 'right'
}
