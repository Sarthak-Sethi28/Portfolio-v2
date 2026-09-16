import { SceneCanvas } from '@/overlay/SceneCanvas'
import { BootCover } from '@/overlay/BootCover'
import { Title } from '@/overlay/Title'
import { Stats } from '@/overlay/Stats'
import { HoverLabel } from '@/overlay/HoverLabel'
import { Controls } from '@/overlay/Chrome/Controls'
import { BlenderTunnelTransition } from '@/world/cinematic/BlenderTunnelTransition'

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SceneCanvas />
      <Title />
      <HoverLabel />
      <Controls />
      {/* Preview layer: the real Blender tunnel render, over the live scene. */}
      <BlenderTunnelTransition />
      <Stats />
      {/* Last, so it covers everything above until the world is really there. */}
      <BootCover />
    </main>
  )
}
