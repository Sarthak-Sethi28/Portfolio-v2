'use client'

import { useMemo, type ReactNode } from 'react'
import { archedPlate } from '../geometry/arch'

/**
 * One arched bay, cut into a pier face.
 *
 * The reference's pillars are not boxes with a picture of an arch on them —
 * the arch is a real void with real depth, and what reads as "carved" at
 * distance is the stack of RECESSED ORDERS around it. Each order is a plate
 * with a slightly smaller opening set slightly further back, so every step
 * catches its own line of shadow. Three orders is enough to read as masonry;
 * one reads as a hole.
 *
 * Flanking colonnettes and a sill finish it, because a real opening is always
 * framed and always sits on something.
 */
export function ArchedBay({
  width,
  height,
  depth,
  children,
}: {
  /** Width of the pier face this bay is cut into. */
  width: number
  /** Height of the bay overall. */
  height: number
  /** Depth of the recess. */
  depth: number
  /** The shared material. */
  children: ReactNode
}) {
  const openW = width * 0.52
  const openH = height * 0.74
  const sill = height * 0.06

  // Three orders, each smaller and further back than the last.
  const orders = useMemo(
    () =>
      [0, 1].map((i) => {
        const t = i / 2
        return {
          geo: archedPlate(
            width,
            height,
            openW * (1 - t * 0.13),
            openH * (1 - t * 0.07),
            depth * 0.3,
            sill,
          ),
          z: -i * depth * 0.28,
        }
      }),
    [width, height, depth, openW, openH, sill],
  )

  const colW = width * 0.045

  return (
    <group>
      {orders.map((o, i) => (
        <mesh key={i} geometry={o.geo} position={[0, 0, o.z]}>
          {children}
        </mesh>
      ))}

      {/* Colonnettes flanking the opening, with a capital and a base — the
          thin shafts that make a gothic bay read as built rather than punched. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * openW) / 2 + s * colW * 0.9, 0, depth * 0.08]}>
          <mesh position={[0, sill + openH * 0.33, 0]}>
            <cylinderGeometry args={[colW / 2, colW / 2, openH * 0.62, 10]} />
            {children}
          </mesh>
          {/* Capital */}
          <mesh position={[0, sill + openH * 0.66, 0]}>
            <cylinderGeometry args={[colW * 0.78, colW * 0.55, height * 0.028, 10]} />
            {children}
          </mesh>
          {/* Base */}
          <mesh position={[0, sill + openH * 0.02, 0]}>
            <cylinderGeometry args={[colW * 0.62, colW * 0.8, height * 0.024, 10]} />
            {children}
          </mesh>
        </group>
      ))}

      {/* Sill, projecting slightly. */}
      <mesh position={[0, sill * 0.5, depth * 0.14]}>
        <boxGeometry args={[openW * 1.5, sill, depth * 0.42]} />
        {children}
      </mesh>
    </group>
  )
}
