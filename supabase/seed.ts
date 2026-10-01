// Seeds schools_directory from lib/data/schools_directory.csv (IPEDS, ~2,510 rows)
// and seeds the curated `schools` table with initial launch campuses.
// Run via: npx ts-node supabase/seed.ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

config({ path: join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — check .env.local'
  )
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Launch campuses to activate in the curated `schools` table.
// Matched to schools_directory by ipeds_id.
const LAUNCH_SCHOOLS = [
  { ipeds_id: '167358', slug: 'northeastern-boston' }, // Northeastern University
]

type DirectoryRow = {
  name: string
  campus: string
  city: string
  state: string
  ipeds_id: string
  domain: string
}

// Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas
// (a few institution names in the IPEDS data contain commas, e.g.
// "University of Maryland, Baltimore").
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c === '\r') {
      // skip, \n handles the row break
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function loadDirectoryRows(): DirectoryRow[] {
  const csvPath = join(process.cwd(), 'lib', 'data', 'schools_directory.csv')
  const text = readFileSync(csvPath, 'utf-8')
  const [header, ...rows] = parseCsv(text).filter((r) => r.length > 1 || r[0] !== '')
  const cols = header.map((h) => h.trim())

  return rows.map((r) => {
    const obj: Record<string, string> = {}
    cols.forEach((col, i) => {
      obj[col] = (r[i] ?? '').trim()
    })
    return obj as DirectoryRow
  })
}

async function seedSchoolsDirectory(rows: DirectoryRow[]) {
  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
      name: r.name,
      campus: r.campus || null,
      city: r.city || null,
      state: r.state || null,
      ipeds_id: r.ipeds_id || null,
      domain: r.domain || null,
    }))

    const { error } = await supabase
      .from('schools_directory')
      .upsert(batch, { onConflict: 'ipeds_id' })

    if (error) {
      throw new Error(`schools_directory upsert failed at row ${i}: ${error.message}`)
    }
    inserted += batch.length
    console.log(`  schools_directory: ${inserted}/${rows.length}`)
  }
}

async function seedActiveSchools() {
  for (const launch of LAUNCH_SCHOOLS) {
    const { data: directoryRow, error: lookupError } = await supabase
      .from('schools_directory')
      .select('id, name')
      .eq('ipeds_id', launch.ipeds_id)
      .single()

    if (lookupError || !directoryRow) {
      throw new Error(
        `Could not find schools_directory row for ipeds_id ${launch.ipeds_id}: ${lookupError?.message}`
      )
    }

    // launched_at is deliberately NOT set here. It records when a school's
    // students actually get access — i.e. the NEXT_PUBLIC_LAUNCHED flip — not
    // when this seed script happened to run. Stamping now() made Northeastern
    // read as "launched 2026-07-10" while the site was still a teaser page,
    // which would misreport launch dates in any later expansion analysis or
    // "live since" copy. Set it at launch instead.
    const { error: upsertError } = await supabase.from('schools').upsert(
      {
        directory_id: directoryRow.id,
        slug: launch.slug,
        active: true,
      },
      { onConflict: 'slug' }
    )

    if (upsertError) {
      throw new Error(`schools upsert failed for ${launch.slug}: ${upsertError.message}`)
    }
    console.log(`  schools: activated ${directoryRow.name} (${launch.slug})`)
  }
}

async function main() {
  console.log('Loading schools_directory.csv...')
  const rows = loadDirectoryRows()
  console.log(`Parsed ${rows.length} rows`)

  console.log('Seeding schools_directory...')
  await seedSchoolsDirectory(rows)

  console.log('Seeding active schools...')
  await seedActiveSchools()

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
