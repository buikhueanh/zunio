'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'
import { fetchListings, type ListingSummary, type SortOption } from '@/lib/listings'
import SchoolSwitcher from './SchoolSwitcher'
import SearchBar from './SearchBar'
import SortSelect from './SortSelect'
import FilterPanel, { type FilterState } from './FilterPanel'
import ListingGrid from './ListingGrid'

const SCHOOL_STORAGE_KEY = 'zunio.browse.schoolId'
const SCHOOL_LABEL_STORAGE_KEY = 'zunio.browse.schoolLabel'

const EMPTY_FILTERS: FilterState = {
  category: null,
  condition: null,
  maxPrice: null,
  freeOnly: false,
}

interface BrowsePageProps {
  initialListings: ListingSummary[]
  initialNextCursor: string | null
  defaultSchoolId: string
  defaultSchoolLabel: string
  // Set when the viewer is signed in: their profile school always wins over
  // any localStorage value from a previous logged-out session.
  userSchoolId: string | null
}

export default function BrowsePage({
  initialListings,
  initialNextCursor,
  defaultSchoolId,
  defaultSchoolLabel,
  userSchoolId,
}: BrowsePageProps) {
  const [schoolId, setSchoolId] = useState(defaultSchoolId)
  const [schoolLabel, setSchoolLabel] = useState(defaultSchoolLabel)
  const [listings, setListings] = useState(initialListings)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortOption>('newest')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const isInitialRender = useRef(true)

  // Restore the logged-out visitor's last school. Signed-in users always start
  // at their profile school, so this only runs when userSchoolId is null.
  useEffect(() => {
    if (userSchoolId) return
    const storedId = window.localStorage.getItem(SCHOOL_STORAGE_KEY)
    const storedLabel = window.localStorage.getItem(SCHOOL_LABEL_STORAGE_KEY)
    if (storedId && storedLabel && storedId !== defaultSchoolId) {
      setSchoolId(storedId)
      setSchoolLabel(storedLabel)
    }
  }, [userSchoolId, defaultSchoolId])

  const runQuery = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { listings: rows, nextCursor: cursor } = await fetchListings(supabase, {
      schoolId,
      category: filters.category ?? undefined,
      condition: filters.condition ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      freeOnly: filters.freeOnly,
      sort,
      query,
    })
    setListings(rows)
    setNextCursor(cursor)
    setLoading(false)
  }, [schoolId, filters, sort, query])

  // Skips the first render — the server already provided that exact page.
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }
    runQuery()
  }, [runQuery])

  function handleSchoolSelect(nextId: string, nextLabel: string) {
    setSchoolId(nextId)
    setSchoolLabel(nextLabel)
    window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextId)
    window.localStorage.setItem(SCHOOL_LABEL_STORAGE_KEY, nextLabel)
  }

  async function handleLoadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    const supabase = createClient()
    const { listings: rows, nextCursor: cursor } = await fetchListings(supabase, {
      schoolId,
      category: filters.category ?? undefined,
      condition: filters.condition ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      freeOnly: filters.freeOnly,
      sort,
      query,
      cursor: nextCursor,
    })
    setListings((prev) => [...prev, ...rows])
    setNextCursor(cursor)
    setLoadingMore(false)
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="flex min-h-screen flex-col bg-brand-white">
      <header className="border-b border-brand-gray-200 px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/listings/new"
              className="rounded-md bg-brand-emerald px-4 py-2 font-semibold text-brand-white transition hover:bg-brand-emerald-hover"
            >
              Post a listing
            </Link>
            <Link href="/account" className="font-medium text-brand-blue hover:underline">
              Account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6 md:px-10">
        <div className="flex flex-col gap-4">
          <SchoolSwitcher
            currentSchoolId={schoolId}
            currentLabel={schoolLabel}
            onSelect={handleSchoolSelect}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchBar value={query} onChange={setQuery} />
            <SortSelect value={sort} onChange={setSort} disabled={isSearching} />
          </div>

          <FilterPanel filters={filters} onChange={setFilters} />
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="py-16 text-center text-sm text-brand-gray-400">Loading listings...</p>
          ) : (
            <ListingGrid
              listings={listings}
              schoolLabel={schoolLabel}
              searchQuery={isSearching ? query.trim() : undefined}
              isFirstPage
              hasMore={nextCursor !== null}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
            />
          )}
        </div>
      </main>

      <footer className="mx-auto mt-10 flex w-full max-w-7xl items-center justify-between border-t border-brand-gray-200 px-6 py-6 md:px-10">
        <p className="text-xs text-brand-gray-400">© 2026 Zunio. For students, by students.</p>
        <Link href="/about" className="text-xs font-medium text-brand-blue hover:underline">
          About us
        </Link>
      </footer>
    </div>
  )
}
