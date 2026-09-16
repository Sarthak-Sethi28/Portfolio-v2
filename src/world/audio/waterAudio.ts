'use client'

/**
 * The world's sound, synthesised rather than sampled.
 *
 * No audio files. A loop of surf would be a few megabytes, would need a licence,
 * and — worse — would repeat: the ear finds the seam in a looping ocean within
 * about thirty seconds and never unhears it. Filtered noise never repeats,
 * costs nothing to download, and can be driven continuously by the same
 * timeline the water is driven by. When the machine takes hold of the sea, the
 * sound is the sea being taken hold of, not a second clip played over it.
 *
 * Three layers:
 *
 *   SWELL   low-passed noise, slow gain breathing — the body of the water
 *   SURF    band-passed noise an octave up — the texture on its surface
 *   DRONE   two detuned oscillators through a resonant filter, silent until
 *           the ring lights, which is the machine itself
 *
 * Everything is a ramp. Web Audio's setTargetAtTime smooths on the audio
 * thread, so a parameter can be written every frame without stepping, and a
 * dropped frame is inaudible rather than a click.
 */

interface Engine {
  ctx: AudioContext
  master: GainNode
  swellGain: GainNode
  swellFilter: BiquadFilterNode
  surfGain: GainNode
  surfFilter: BiquadFilterNode
  droneGain: GainNode
  droneFilter: BiquadFilterNode
  sources: AudioScheduledSourceNode[]
}

let engine: Engine | null = null
let started = false

/** Eight seconds of brown-ish noise, generated once and looped by the source. */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  /*
   * Brown noise, not white.
   *
   * White noise is flat across the spectrum and reads as hiss — a television,
   * not an ocean. Integrating it tilts the energy toward the bottom end at
   * roughly 6dB per octave, which is what moving water actually sounds like.
   * The running value is leaked back toward zero so it cannot wander into DC.
   */
  let last = 0
  let peak = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.021 * white) / 1.021
    data[i] = last
    const a = Math.abs(last)
    if (a > peak) peak = a
  }
  /*
   * Normalise rather than multiply by a guessed constant.
   *
   * The integrator's output level depends on its leak coefficient, so a fixed
   * multiplier is a guess that was quietly wrong — the buffer came out around
   * -28dBFS, which measured as working and was inaudible on a laptop.
   */
  const norm = peak > 0 ? 0.9 / peak : 1
  for (let i = 0; i < length; i++) data[i] *= norm

  // Cross-fade the tail into the head so the loop point is not a discontinuity.
  const fade = Math.min(4096, (length / 4) | 0)
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    data[i] = data[i] * k + data[length - fade + i] * (1 - k)
  }
  return buffer
}

function loopingNoise(ctx: AudioContext, buffer: AudioBuffer, rate: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.playbackRate.value = rate
  return src
}

/** A slow oscillator writing into a gain, so a layer breathes rather than sits. */
function breath(ctx: AudioContext, target: AudioParam, hz: number, depth: number): OscillatorNode {
  const lfo = ctx.createOscillator()
  lfo.frequency.value = hz
  const amount = ctx.createGain()
  amount.gain.value = depth
  lfo.connect(amount).connect(target)
  return lfo
}

export function initAudio(): boolean {
  if (engine) return true
  if (typeof window === 'undefined') return false

  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return false

  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const buffer = noiseBuffer(ctx, 8)

  // SWELL — the body of the water.
  const swellFilter = ctx.createBiquadFilter()
  swellFilter.type = 'lowpass'
  swellFilter.frequency.value = 900
  swellFilter.Q.value = 0.7
  const swellGain = ctx.createGain()
  swellGain.gain.value = 0.45
  const swell = loopingNoise(ctx, buffer, 0.85)
  swell.connect(swellFilter).connect(swellGain).connect(master)

  // SURF — the texture on the surface, quieter and higher.
  const surfFilter = ctx.createBiquadFilter()
  surfFilter.type = 'bandpass'
  surfFilter.frequency.value = 1250
  surfFilter.Q.value = 0.5
  const surfGain = ctx.createGain()
  surfGain.gain.value = 0.16
  const surf = loopingNoise(ctx, buffer, 1.37)
  surf.connect(surfFilter).connect(surfGain).connect(master)

  /*
   * Two breaths at incommensurable rates.
   *
   * 0.043Hz and 0.067Hz never line up, so the swell never arrives on a count
   * the listener can predict. One shared rate would turn the ocean into a
   * metronome within a minute.
   */
  const b1 = breath(ctx, swellGain.gain, 0.043, 0.16)
  const b2 = breath(ctx, surfGain.gain, 0.067, 0.06)

  // DRONE — the machine. Silent until the ring lights.
  const droneFilter = ctx.createBiquadFilter()
  droneFilter.type = 'bandpass'
  droneFilter.frequency.value = 90
  droneFilter.Q.value = 6
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0
  const oscA = ctx.createOscillator()
  oscA.type = 'sawtooth'
  oscA.frequency.value = 44
  const oscB = ctx.createOscillator()
  oscB.type = 'sawtooth'
  // Detuned by a few cents: the slow beat between them is what makes a drone
  // feel like a machine under load rather than a test tone.
  oscB.frequency.value = 44.6
  oscA.connect(droneFilter)
  oscB.connect(droneFilter)
  droneFilter.connect(droneGain).connect(master)

  const sources: AudioScheduledSourceNode[] = [swell, surf, b1, b2, oscA, oscB]
  for (const s of sources) s.start()

  engine = {
    ctx,
    master,
    swellGain,
    swellFilter,
    surfGain,
    surfFilter,
    droneGain,
    droneFilter,
    sources,
  }
  started = true
  return true
}

/**
 * Browsers refuse to start audio without a gesture, and correctly so.
 * Called from the first real interaction; harmless if already running.
 */
export async function resumeAudio(): Promise<void> {
  if (!engine) initAudio()
  if (engine && engine.ctx.state === 'suspended') {
    await engine.ctx.resume().catch(() => undefined)
  }
}

export function audioReady(): boolean {
  return started && engine?.ctx.state === 'running'
}

const ramp = (p: AudioParam, value: number, time: number, tau = 0.25) => {
  p.setTargetAtTime(value, time, tau)
}

/** Overall level. 0 mutes without tearing down the graph. */
export function setAudioLevel(level: number): void {
  if (!engine) return
  ramp(engine.master.gain, Math.max(0, Math.min(1, level)) * 0.9, engine.ctx.currentTime, 0.4)
}

/**
 * Written every frame from the cinematic.
 *
 * `night` darkens the sea rather than quieting it: the cutoff drops, so the
 * water loses its highs the way a real one does after dark. `power` and
 * `ignition` bring the machine up underneath it.
 */
export function updateAudio(state: {
  night: number
  disturbance: number
  power: number
  ignition: number
  shockwave: number
  blackout: number
}): void {
  if (!engine) return
  const t = engine.ctx.currentTime
  const { night, disturbance, power, ignition, shockwave, blackout } = state

  // The sea rises as it is disturbed, and the surf opens up with it.
  ramp(engine.swellGain.gain, 0.42 + disturbance * 0.34, t, 0.5)
  ramp(engine.swellFilter.frequency, 900 - night * 260 + disturbance * 420, t, 0.6)
  ramp(engine.surfGain.gain, 0.15 + disturbance * 0.13 + shockwave * 0.08, t, 0.4)
  ramp(engine.surfFilter.frequency, 1250 - night * 380 + disturbance * 900, t, 0.6)

  // The machine. Nothing until the ring has power, then a rising resonance.
  const machine = Math.max(power, ignition)
  ramp(engine.droneGain.gain, machine * 0.30, t, 0.5)
  ramp(engine.droneFilter.frequency, 90 + ignition * 130 + shockwave * 90, t, 0.4)
  ramp(engine.droneFilter.Q, 6 + ignition * 10, t, 0.5)

  // Everything ducks into the blackout, so the tunnel is entered in near
  // silence and the world comes back with its own sound.
  ramp(engine.master.gain, (1 - blackout * 0.92) * 0.9 * currentLevel, t, 0.25)
}

/** Remembered so updateAudio can duck relative to the user's chosen level. */
let currentLevel = 0
export function setLevel(level: number): void {
  currentLevel = Math.max(0, Math.min(1, level))
  setAudioLevel(currentLevel)
}
