import { SceneCanvas } from '@/overlay/SceneCanvas'
import { Title } from '@/overlay/Title'
import { Stats } from '@/overlay/Stats'
import { HoverLabel } from '@/overlay/HoverLabel'

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SceneCanvas />
      <Title />
      <HoverLabel />
      <Stats />
    </main>
  )
}
