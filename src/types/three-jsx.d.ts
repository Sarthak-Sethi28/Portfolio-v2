/**
 * React 19 moved the JSX namespace out of the global scope and into React's
 * own. React Three Fiber's intrinsic elements (<mesh>, <shaderMaterial>, ...)
 * therefore have to be merged in explicitly, once, here.
 */
import type { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
    interface IntrinsicElements extends ThreeElements {}
    }
  }
}

export {}
