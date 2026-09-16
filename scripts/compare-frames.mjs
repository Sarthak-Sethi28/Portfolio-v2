/**
 * Numeric comparison of two frames.
 *
 * The endpoint contracts are the one thing in this project that must not
 * drift, and "it looks the same" is exactly how drift survives review. Mean
 * absolute difference plus a count of materially changed pixels gives a number
 * that can be argued with.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const [a, bPath] = process.argv.slice(2)
const enc = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64')

const br = await chromium.launch()
const pg = await br.newPage()
const r = await pg.evaluate(async ([srcA, srcB]) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s })
  const [ia, ib] = await Promise.all([load(srcA), load(srcB)])
  const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height)
  const g = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data }
  const da = g(ia), db = g(ib)
  let sum = 0, changed = 0
  for (let i = 0; i < da.length; i += 4) {
    const d = (Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2])) / 3
    sum += d
    if (d > 12) changed++
  }
  const px = da.length / 4
  return { size: `${w}x${h}`, meanAbsDiff: +(sum / px).toFixed(2), changedPct: +(changed / px * 100).toFixed(2) }
}, [enc(a), enc(bPath)])
console.log(`${a.split('/').pop()} vs ${bPath.split('/').pop()}: ${JSON.stringify(r)}`)
await br.close()
