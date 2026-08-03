import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { generateSlug } from '@/utils/slug'

export type SchoolDirectoryResult = {
  id: string
  name: string
  campus: string | null
  city: string | null
  state: string | null
}

export type SchoolSelection =
  | { schoolId: string; label: string }
  | { schoolNameRaw: string }
  | null

const RESULT_LIMIT = 8

export async function searchSchoolsDirectory(query: string): Promise<SchoolDirectoryResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('schools_directory')
    .select('id, name, campus, city, state')
    .ilike('name', `%${trimmed}%`)
    .order('name', { ascending: true })
    .limit(RESULT_LIMIT)

  if (error) {
    console.error('searchSchoolsDirectory failed', error)
    return []
  }
  return data
}

// Active/launched campuses only — this is what users.school_id FKs to, not
// schools_directory. The `schools` table is small and manually curated by
// design, so we fetch it in full rather than debounce-searching per keystroke.
type ActiveSchoolRow = {
  id: string
  schools_directory: { name: string; campus: string | null; city: string | null; state: string | null } | null
}

export async function getActiveSchools(): Promise<SchoolDirectoryResult[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('schools')
    .select('id, schools_directory(name, campus, city, state)')
    .eq('active', true)
    .returns<ActiveSchoolRow[]>()

  if (error) {
    console.error('getActiveSchools failed', error)
    return []
  }

  return data
    .filter((row) => row.schools_directory !== null)
    .map((row) => ({
      id: row.id,
      name: row.schools_directory!.name,
      campus: row.schools_directory!.campus,
      city: row.schools_directory!.city,
      state: row.schools_directory!.state,
    }))
}

// Server-only — sign-up can select any of the ~2,510 schools in
// schools_directory, not just launched ones (see DECISIONS.md). This
// resolves a directory pick to a real schools.id, creating an inactive
// `schools` row on first use if one doesn't exist yet. Takes a service-role
// client since it writes to `schools`, which has no client-facing INSERT policy.
export async function getOrCreateSchool(
  supabase: SupabaseClient,
  directoryId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('schools')
    .select('id')
    .eq('directory_id', directoryId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: directory, error: directoryError } = await supabase
    .from('schools_directory')
    .select('name')
    .eq('id', directoryId)
    .single()

  if (directoryError || !directory) {
    throw new Error(`Unknown school directory id: ${directoryId}`)
  }

  const slug = generateSlug(directory.name)
  const { data: created, error: insertError } = await supabase
    .from('schools')
    .insert({ directory_id: directoryId, slug, active: false })
    .select('id')
    .single()

  if (insertError || !created) {
    throw new Error(`Could not create school for directory id: ${directoryId}`)
  }

  return created.id
}
