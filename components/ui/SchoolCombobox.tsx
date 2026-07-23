'use client'

import { useEffect, useRef, useState } from 'react'
import { searchSchoolsDirectory, type SchoolDirectoryResult, type SchoolSelection } from '@/lib/schools'

interface SchoolComboboxProps {
  value: SchoolSelection
  onChange: (selection: SchoolSelection) => void
}

const DEBOUNCE_MS = 250

function formatSchoolLabel(school: SchoolDirectoryResult): string {
  const location = [school.campus, school.city, school.state].filter(Boolean).join(', ')
  return location ? `${school.name} — ${location}` : school.name
}

export default function SchoolCombobox({ value, onChange }: SchoolComboboxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SchoolDirectoryResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isUnlisted, setIsUnlisted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextSearch = useRef(false)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (isUnlisted || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const matches = await searchSchoolsDirectory(query)
      setResults(matches)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, isUnlisted])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectSchool(school: SchoolDirectoryResult) {
    skipNextSearch.current = true
    onChange({ schoolId: school.id, label: formatSchoolLabel(school) })
    setQuery(formatSchoolLabel(school))
    setResults([])
    setIsOpen(false)
  }

  function toggleUnlisted() {
    const next = !isUnlisted
    setIsUnlisted(next)
    setQuery('')
    setResults([])
    setIsOpen(false)
    onChange(null)
  }

  if (isUnlisted) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={value && 'schoolNameRaw' in value ? value.schoolNameRaw : ''}
          onChange={(e) => onChange(e.target.value ? { schoolNameRaw: e.target.value } : null)}
          placeholder="Enter your school's name"
          className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
        />
        <button
          type="button"
          onClick={toggleUnlisted}
          className="w-fit text-xs font-medium text-brand-blue underline-offset-2 hover:underline"
        >
          Search the school list instead
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
          if (value) onChange(null)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search for your school"
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      {isOpen && results.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-brand-gray-200 bg-brand-white shadow-lg">
          {results.map((school) => (
            <li key={school.id}>
              <button
                type="button"
                onClick={() => selectSchool(school)}
                className="block w-full px-4 py-3 text-left text-sm text-brand-dark-brown hover:bg-brand-emerald-light"
              >
                {formatSchoolLabel(school)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={toggleUnlisted}
        className="w-fit text-xs font-medium text-brand-blue underline-offset-2 hover:underline"
      >
        My school isn&apos;t listed
      </button>
    </div>
  )
}
