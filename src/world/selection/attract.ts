'use client'

/**
 * THE NUDGE.
 *
 * A visitor who does not know the columns are interactive will never find out,
 * and the legend at the bottom is easy to miss. The permanent answers — name
 * tags at every column, rings on the water — were tried and were too much: they
 * turned a world into a menu.
 *
 * So the world says it once, itself. After a few seconds of nothing happening,
 * the four columns lift very slightly in sequence and settle. It reads as the
 * sea moving them, not as an interface asking to be clicked, and the one thing
 * a person cannot fail to notice is a thing that moves.
 *
 * It stops permanently the first time the visitor touches any column, and it
 * never plays again in that session. A hint that keeps hinting after it has
 * been understood is nagging.
 */

/** 0 at rest, rising to 1 at the top of a pulse. Read by ModelPier. */
export const attract = { value: 0 }

/** Set the moment a pillar is hovered or opened; silences the nudge for good. */
export const attractDone = { value: false }

/** Seconds of stillness before the world offers the hint. */
export const ATTRACT_DELAY = 5.5

/** How long one pulse takes, and how many there are. */
export const ATTRACT_PERIOD = 2.4
export const ATTRACT_PULSES = 2

export function silenceAttract(): void {
  attractDone.value = true
  attract.value = 0
}
