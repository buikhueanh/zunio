'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import SiteFooter from '@/components/ui/SiteFooter'
import { MessageCircle, User } from 'lucide-react'
import { button, cx } from '@/lib/ui-classes'
import TrustSection from '@/components/marketing/TrustSection'
import { createClient } from '@/lib/supabase/client'
import { fetchListings, type ListingSummary, type SortOption } from '@/lib/listings'
import BrowseHero from './BrowseHero'
import CategoryPills from './CategoryPills'
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
  userSchoolId: string | null
  isSignedIn: boolean
}

export default function BrowsePage({
  initialListings,
  initialNextCursor,
  defaultSchoolId,
  defaultSchoolLabel,
  userSchoolId,
  isSignedIn,
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
  const [collapsed, setCollapsed] = useState(false)
  const isInitialRender = useRef(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // The marketing hero is for people deciding whether Zunio is real. Someone
  // already signed in knows — every pixel of pitch is friction on a daily visit.
  const showHero = !isSignedIn

  /**
   * Collapse state via IntersectionObserver on a sentinel placed directly
   * BELOW the hero's own search + school controls.
   *
   * Placement is the whole design: the sticky bar duplicates those two
   * controls, so it should appear exactly when the originals scroll out of
   * view — never while both copies are on screen at once. Watching scroll
   * direction instead would re-expand on any small upward nudge, shoving the
   * hero back over content you were reading. IntersectionObserver also does no
   * work per scroll frame, so there is nothing to throttle on a slow phone.
   */
  useEffect(() => {
    if (!showHero) {
      setCollapsed(true)
      return
    }
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [showHero])

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

  // Controls live in the hero while it's on screen; the sticky bar takes over
  // once it scrolls away, and is always shown when there's no hero at all.
  const controlsVisible = !showHero || collapsed

  const isSearching = query.trim().length > 0
  const resultLabel = `${listings.length}${nextCursor ? '+' : ''} item${
    listings.length === 1 ? '' : 's'
  }`

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream-light">
      <header className="sticky top-0 z-50 border-b border-brand-gray-200 bg-brand-white/92 px-6 backdrop-blur-lg md:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 py-3.5">
          {/* Logo centred between two equal-width flanks, matching the design.
              flex-1 on both sides keeps it optically centred regardless of how
              wide the action buttons get. */}
          <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
            <Link href="/about" className={button.ghost}>
              About
            </Link>
          </nav>
          <Link href="/" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <nav className="flex flex-1 items-center justify-end gap-3 text-sm">
            {isSignedIn ? (
              <>
                {/* Sell Item stays a labelled button — it is the primary
                    action and shouldn't compete with two quiet icons. */}
                <Link
                  href="/listings/new"
                  className={button.primary}
                >
                  Sell Item
                </Link>
                <Link
                  href="/messages"
                  aria-label="Messages"
                  title="Messages"
                  className={button.icon}
                >
                  <MessageCircle className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  href="/account"
                  aria-label="Account"
                  title="Account"
                  className={button.icon}
                >
                  <User className="h-5 w-5" aria-hidden />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className={button.primary}
                >
                  Sell Item
                </Link>
                <Link
                  href="/sign-in"
                  className={button.outlineBlue}
                >
                  Log In
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {showHero && (
        <BrowseHero
          controlsSentinelRef={sentinelRef}
          search={<SearchBar value={query} onChange={setQuery} />}
          schoolSwitcher={
            <SchoolSwitcher
              currentSchoolId={schoolId}
              currentLabel={schoolLabel}
              onSelect={handleSchoolSelect}
              variant="onDark"
            />
          }
        />
      )}

      {/*
        Sticky control bar. It sits below the header and compacts once the hero
        has scrolled away: padding tightens, a shadow appears, and the search +
        school controls fade in (they live in the hero while expanded).
        Transitions are on transform/opacity/shadow — never on height — so the
        page never reflows mid-scroll and there is no layout shift.
      */}
      <div
        className={`sticky top-[61px] z-40 border-b bg-brand-cream-light/95 px-6 backdrop-blur-lg transition-all duration-300 motion-reduce:transition-none md:px-10 ${
          collapsed
            ? 'border-brand-gray-200 py-2.5 shadow-sm'
            : 'border-transparent py-4'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl">
          <div
            className={`grid transition-all duration-300 motion-reduce:transition-none ${
              controlsVisible ? 'mb-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            {/*
              overflow-hidden is what makes the grid-rows 1fr/0fr collapse
              animate — but it also clips anything absolutely positioned
              inside, which silently sliced the school dropdown off at the
              row's height so only the first campus was reachable. Only clip
              while the row is actually collapsing away.
            */}
            <div className={controlsVisible ? 'overflow-visible' : 'overflow-hidden'}>
              <div className="flex flex-wrap items-center gap-3">
                <SchoolSwitcher
                  currentSchoolId={schoolId}
                  currentLabel={schoolLabel}
                  onSelect={handleSchoolSelect}
                />
                <div className="min-w-[200px] flex-1">
                  <SearchBar value={query} onChange={setQuery} />
                </div>
              </div>
            </div>
          </div>

          <CategoryPills
            value={filters.category}
            onChange={(category) => setFilters({ ...filters, category })}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-brand-dark-brown">
            {isSearching ? 'Search results' : 'Recently posted'}
            <span className="ml-2 text-sm font-normal text-brand-gray-500">
              {loading ? '' : `${resultLabel} at ${schoolLabel.split(' — ')[0]}`}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterPanel filters={filters} onChange={setFilters} hideCategory />
            <SortSelect value={sort} onChange={setSort} disabled={isSearching} />
          </div>
        </div>

        <div className="mt-6">
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

      {/* Logged-out only: conversion material, not something to re-read daily. */}
      {!isSignedIn && <TrustSection />}

      {/* Always rendered — carries Terms, Privacy and Contact. */}
      <SiteFooter showBridge={!isSignedIn} />
    </div>
  )
}
