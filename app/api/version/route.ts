import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

// Must stay dynamic — otherwise Next.js would evaluate this once at build
// time and bake in the build ID that was current *then*, defeating the point.
export const dynamic = 'force-dynamic'

export async function GET() {
  let buildId: string | null = null
  try {
    buildId = (
      await readFile(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')
    ).trim()
  } catch {
    // No .next/BUILD_ID (e.g. dev server) — buildId stays null.
  }

  return NextResponse.json(
    { buildId },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
