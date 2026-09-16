import { SceneCanvas } from '@/overlay/SceneCanvas'
import { BootCover } from '@/overlay/BootCover'
import { Title } from '@/overlay/Title'
import { PillarPanels } from '@/overlay/selection/PillarPanels'
import { Stats } from '@/overlay/Stats'
import { HoverLabel } from '@/overlay/HoverLabel'
import { TransitionHint } from '@/overlay/TransitionHint'
import { SoundToggle } from '@/overlay/SoundToggle'
import { Webring } from '@/overlay/Webring'
import { Controls } from '@/overlay/Chrome/Controls'
import { BlenderTunnelTransition } from '@/world/cinematic/BlenderTunnelTransition'

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SceneCanvas />
      <Title />
      <HoverLabel />
      <TransitionHint />
      <SoundToggle />
      <Webring />
      {/* All four monuments. One shell, four sets of children. */}
      <PillarPanels />
      <Controls />
      {/* Preview layer: the real Blender tunnel render, over the live scene. */}
      <BlenderTunnelTransition />
      <Stats />
      {/* Last, so it covers everything above until the world is really there. */}
      <BootCover />
    </main>
  )
}
