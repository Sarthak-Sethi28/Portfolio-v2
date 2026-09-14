/**
 * Collapse Blender's per-object animations into ONE clip.
 *
 * Blender's glTF exporter writes a separate animation per animated object even
 * in SCENE mode — 38 of them here, all sampled on the same 0..15s scene
 * timeline. They are perfectly in step, but a consumer still has to create 38
 * AnimationActions and start them together, and anything that has to be kept
 * in step by hand will eventually drift by hand.
 *
 * Every channel already shares one timebase, so merging is just moving the
 * channels onto a single animation and dropping the empties. The result is one
 * clip named "Cinematic": play it, scrub it, and the whole machine moves.
 */
import { NodeIO } from '@gltf-transform/core'

const [src, dst] = process.argv.slice(2)
const io = new NodeIO()
const doc = await io.read(src)
const root = doc.getRoot()

const anims = root.listAnimations()
if (anims.length === 0) {
  console.error('no animations found')
  process.exit(1)
}

const target = anims[0].setName('Cinematic')
let moved = 0
for (const a of anims.slice(1)) {
  for (const ch of a.listChannels()) {
    a.removeChannel(ch)
    target.addChannel(ch)
    moved++
  }
  for (const s of a.listSamplers()) {
    a.removeSampler(s)
    target.addSampler(s)
  }
  a.dispose()
}

await io.write(dst, doc)

const merged = doc.getRoot().listAnimations()
console.log(`merged ${anims.length} clips into "${merged[0].getName()}"`)
console.log(`channels: ${merged[0].listChannels().length}, clips now: ${merged.length}`)
