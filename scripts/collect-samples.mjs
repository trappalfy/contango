/** Polls /api/history so the server records real ratio samples. */
const BASE = process.argv[2] ?? 'http://localhost:3111'
const MINUTES = Number(process.argv[3] ?? 9)
const deadline = Date.now() + MINUTES * 60_000

let last = 0
while (Date.now() < deadline) {
  try {
    const r = await fetch(`${BASE}/api/history`)
    const j = await r.json()
    if (j.samples.length !== last) {
      last = j.samples.length
      const latest = j.samples[j.samples.length - 1]
      console.log(
        `${new Date().toISOString().slice(11, 19)}  samples=${String(last).padStart(3)}  ratio=${latest?.ratio.toFixed(5)}  band=${j.band ? 'yes' : 'no'}`,
      )
    }
  } catch (e) {
    console.log('poll failed:', e.message)
  }
  await new Promise((r) => setTimeout(r, 5000))
}
console.log('done, samples:', last)
