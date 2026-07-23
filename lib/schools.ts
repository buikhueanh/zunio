import { createClient } from '@/lib/supabase/client'

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
