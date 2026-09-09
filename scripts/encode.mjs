import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Encodes the captured frames — §10 and §11 of the video spec.
 *
 * The flags are the spec's. The binaries come from node_modules rather than
 * the PATH, because this machine has no system ffmpeg and a video toolchain is
 * not something to install globally on a machine's behalf.
 *
 * Run: node scripts/encode.mjs
 */
const require = createRequire(import.meta.url)
const ffmpeg = require('ffmpeg-static')
const ffprobe = require('ffprobe-static').path

const OUT = 'contango-welcome.mp4'

// X accepts H.264 only; H.265, VP9 and AV1 are rejected without a message.
execFileSync(
  ffmpeg,
  [
    '-y',
    '-framerate', '30',
    '-i', 'frames/%04d.png',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-crf', '16',
    '-movflags', '+faststart',
    // No track at all. If sound is ever wanted it gets its own decision, not a
    // side effect of encoding.
    '-an',
    OUT,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)

const probe = execFileSync(
  ffprobe,
  [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate',
    '-show_entries', 'format=duration,size',
    '-of', 'default=noprint_wrappers=1',
    OUT,
  ],
  { encoding: 'utf8' },
)

console.log(probe.trim())

const bytes = statSync(OUT).size
console.log(`\n${OUT} — ${(bytes / 1024 / 1024).toFixed(2)} MB`)
console.log(`under X's 512 MB ceiling: ${bytes < 512 * 1024 * 1024 ? 'yes' : 'NO'}`)
