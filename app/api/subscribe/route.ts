import { NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

/**
 * The footer's subscribe form.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS RATHER THAN A DECORATIVE FORM
 *
 * §2 of the footer brief argues the form back into the footer, and §2 also
 * lays down the rule that settles how it must be built: a control that
 * promises a function it does not have is the worst of the available options.
 * So this validates, de-duplicates and actually stores the address.
 *
 * Storage is a JSON file beside the app. That is a real store — it survives
 * restarts, which the ratio history does not — but it is still single-node.
 * A list provider or a table replaces `read` and `write` and nothing else.
 * ---------------------------------------------------------------------------
 */

const STORE_DIR = path.join(process.cwd(), '.data')
const STORE_FILE = path.join(STORE_DIR, 'subscribers.json')

const Payload = z.object({
  email: z.string().trim().min(3).max(254).email(),
  name: z.string().trim().max(120).optional(),
})

type Record_ = { email: string; name?: string; at: string }

async function read(): Promise<Record_[]> {
  try {
    const raw = await readFile(STORE_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Record_[]) : []
  } catch {
    // No file yet is the normal first-run state, not an error.
    return []
  }
}

async function write(records: Record_[]): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(records, null, 2), 'utf8')
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 })
  }

  const parsed = Payload.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'That does not look like an email address.' },
      { status: 400 },
    )
  }

  // Case matters in the local part on paper and to nobody in practice; folding
  // it is what stops the same person being stored twice.
  const email = parsed.data.email.toLowerCase()
  const name = parsed.data.name || undefined

  try {
    const records = await read()
    if (records.some((r) => r.email === email)) {
      return NextResponse.json({ ok: true, status: 'already' as const })
    }

    records.push({ email, name, at: new Date().toISOString() })
    await write(records)

    return NextResponse.json({ ok: true, status: 'added' as const })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not record that just now. Try again shortly.' },
      { status: 503 },
    )
  }
}
