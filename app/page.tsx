import TeaserPage from '@/components/marketing/TeaserPage'
import BrowsePage from '@/components/browse/BrowsePage'
import { createClient } from '@/lib/supabase/server'
import { fetchListings } from '@/lib/listings'

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === 'true'
const DEFAULT_SCHOOL_SLUG = 'northeastern-boston'

type SchoolRow = {
  id: string
  schools_directory: {
    name: string
    campus: string | null
    city: string | null
    state: string | null
  } | null
}

function formatSchoolLabel(row: SchoolRow): string {
  const dir = row.schools_directory
  if (!dir) return 'Your school'
  const location = [dir.campus, dir.city, dir.state].filter(Boolean).join(', ')
  return location ? `${dir.name} — ${location}` : dir.name
}

export default async function Home() {
  if (!LAUNCHED) return <TeaserPage />

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let schoolRow: SchoolRow | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.school_id) {
      const { data } = await supabase
        .from('schools')
        .select('id, schools_directory(name, campus, city, state)')
        .eq('id', profile.school_id)
        .maybeSingle<SchoolRow>()
      schoolRow = data
    }
  }

  if (!schoolRow) {
    const { data } = await supabase
      .from('schools')
      .select('id, schools_directory(name, campus, city, state)')
      .eq('slug', DEFAULT_SCHOOL_SLUG)
      .maybeSingle<SchoolRow>()
    schoolRow = data
  }

  if (!schoolRow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-white">
        <p className="text-sm text-brand-gray-500">No schools are available yet.</p>
      </div>
    )
  }

  const { listings, nextCursor } = await fetchListings(supabase, {
    schoolId: schoolRow.id,
  })

  return (
    <BrowsePage
      initialListings={listings}
      initialNextCursor={nextCursor}
      defaultSchoolId={schoolRow.id}
      defaultSchoolLabel={formatSchoolLabel(schoolRow)}
      userSchoolId={user ? schoolRow.id : null}
    />
  )
}
