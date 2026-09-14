import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-gpu'] })
for (const t of (process.argv[2]||'6.25,7.25,8.35,9.35').split(',')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:3001/?seq=${(parseFloat(t)/15).toFixed(5)}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(7000)
  await p.screenshot({ path: `/tmp/d-${t}.png` })
  await ctx.close()
}
await b.close()
