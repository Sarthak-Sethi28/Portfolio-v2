'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'

/**
 * Reports the exact moment the world is genuinely on screen.
 *
 * This lives INSIDE the Suspense boundary that wraps the ocean, the piers and
 * the portal, so React cannot mount it until every one of those has resolved.
 * Mounting is still not enough on its own — the assets are decoded well before
 * the first frame that actually contains them, because the GPU upload and the
 * shader compiles happen during that first render — so it waits for a couple
 * of real rendered frames before saying the world has arrived.
 */
export function WorldReady() {
  const setPhase = useScene((s) => s.setPhase)
  const frames = useRef(0)
  const done = useRef(false)

  useFrame(() => {
    if (done.current) return
    frames.current += 1
    if (frames.current < 3) return
    done.current = true
    setPhase('revealing')
  })

  return null
}
