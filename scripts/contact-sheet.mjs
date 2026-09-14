/**
 * Compose a contact sheet from already-captured frames.
 *
 * Rendered through a headless browser rather than an image library because
 * the project already depends on one, and laying out a labelled grid in HTML
 * is a great deal less code than compositing it by hand.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const [out, cols, ...frames] = process.argv.slice(2)
const cells = frames.map((f) => {
  const [label, path] = f.split('=')
  const b64 = readFileSync(path).toString('base64')
  return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${label}</figcaption></figure>`
})

const html = `<style>
  body { margin:0; background:#0b0d10; font:500 13px/1 ui-monospace,Menlo,monospace; }
  .grid { display:grid; grid-template-columns:repeat(${cols},1fr); gap:6px; padding:6px; }
  figure { margin:0; position:relative; }
  img { width:100%; display:block; }
  figcaption { position:absolute; left:6px; top:6px; color:#fff;
    background:rgba(0,0,0,.62); padding:3px 7px; border-radius:3px; letter-spacing:.04em; }
</style><div class="grid">${cells.join('')}</div>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1800, height: 400 }, deviceScaleFactor: 1 })
await p.setContent(html)
await p.waitForTimeout(600)
await p.locator('.grid').screenshot({ path: out })
await b.close()
console.log('wrote', out)
