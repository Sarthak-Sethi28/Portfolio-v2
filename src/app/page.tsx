import { SceneCanvas } from '@/overlay/SceneCanvas'
import { Title } from '@/overlay/Title'
import { Stats } from '@/overlay/Stats'
import { HoverLabel } from '@/overlay/HoverLabel'
import { Controls } from '@/overlay/Chrome/Controls'

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SceneCanvas />
      <Title />
      <HoverLabel />
      <Controls />
      <Stats />
    </main>
  )
}
