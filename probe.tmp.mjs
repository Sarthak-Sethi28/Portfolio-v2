import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
await page.waitForTimeout(7000)
await page.screenshot({ path: '/tmp/shots/fill.png' })
const lum = []
for (let i = 0; i < 16; i++) {
  await page.mouse.move(200 + ((i*140)%1000), 380 + Math.sin(i*0.8)*150)
  await page.waitForTimeout(45)
  const png = PNG.sync.read(await page.screenshot())
  let sum = 0
  for (let p = 0; p < png.data.length; p += 4*61) sum += 0.2126*png.data[p]+0.7152*png.data[p+1]+0.0722*png.data[p+2]
  lum.push(sum/(png.data.length/(4*61)))
}
const mean = lum.reduce((a,b)=>a+b,0)/lum.length
console.log(`blackframes=${lum.filter(v=>v<mean*0.85).length} spread=${((Math.max(...lum)-Math.min(...lum))/mean*100).toFixed(1)}%`)
await browser.close()
