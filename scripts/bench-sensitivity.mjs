import { chromium } from 'playwright'

const CAMERA_Z = [[0,5.3],[0.28,4.6],[0.38,3.4],[0.5,1.05],[0.58,0.35],[0.68,0.1],[1,0.1]]
// Mirrors sampleSpline() in lib/hero.tokens.ts.
function tangents(track){const n=track.length;const d=new Array(n-1);for(let i=0;i<n-1;i++)d[i]=(track[i+1][1]-track[i][1])/(track[i+1][0]-track[i][0]);const m=new Array(n);m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=(d[i-1]+d[i])/2;for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=0;m[i+1]=0;continue}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const tau=3/Math.sqrt(s);m[i]=tau*a*d[i];m[i+1]=tau*b*d[i]}}return m}
function sample(track, p) {
  if (p <= track[0][0]) return track[0][1]
  const last = track[track.length-1]
  if (p >= last[0]) return last[1]
  const m = tangents(track)
  for (let i=0;i<track.length-1;i++){
    const [x0,y0]=track[i],[x1,y1]=track[i+1]
    if (p>=x0&&p<=x1){ const h=x1-x0,t=(p-x0)/h,t2=t*t,t3=t2*t
      return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*y1+(t3-t2)*h*m[i+1] }
  }
  return last[1]
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:3111/', { waitUntil: 'networkidle' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2500)

const geom = await page.evaluate(() => {
  const w = document.querySelector('[data-hero-pin]')
  return { wrapperHeight: w.offsetHeight, viewport: window.innerHeight }
})
const travel = geom.wrapperHeight - geom.viewport

// One physical wheel notch is ~100px of deltaY in Chrome.
const notch = await page.evaluate(async () => {
  window.scrollTo(0, 0)
  await new Promise(r => setTimeout(r, 400))
  const before = window.scrollY
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
  await new Promise(r => setTimeout(r, 1600)) // let Lenis finish its easing
  return window.scrollY - before
})

console.log(`wrapper=${geom.wrapperHeight}px  viewport=${geom.viewport}px  scroll travel for p 0->1 = ${travel}px`)
console.log(`one wheel notch (deltaY 100) moves scroll by ${notch}px  =>  dp = ${(notch/travel).toFixed(3)}`)
console.log('')
console.log('camera z travel per 100px of scroll, by region:')
for (const [a,b,name] of [[0,0.28,'rest -> approach'],[0.28,0.38,'approach'],[0.38,0.5,'dive'],[0.5,0.58,'pass-through'],[0.58,0.68,'settle inside']]) {
  const dz = Math.abs(sample(CAMERA_Z,b) - sample(CAMERA_Z,a))
  const px = (b-a)*travel
  console.log(`  p ${a}-${b} ${name.padEnd(18)} dz=${dz.toFixed(2)} units over ${px.toFixed(0)}px  =>  ${(dz/px*100).toFixed(2)} units per 100px`)
}
const dpNotch = notch/travel
console.log('')
console.log(`=> a single notch in the dive region moves the camera about ${Math.abs(sample(CAMERA_Z,0.44+dpNotch/2)-sample(CAMERA_Z,0.44-dpNotch/2)).toFixed(2)} units.`)
console.log(`   The sphere radius is 1.0, so that is ${(Math.abs(sample(CAMERA_Z,0.44+dpNotch/2)-sample(CAMERA_Z,0.44-dpNotch/2))/2).toFixed(2)} sphere-diameters per notch.`)

await browser.close()
