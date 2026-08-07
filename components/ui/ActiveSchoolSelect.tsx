'use client'

import { useEffect, useRef, useState } from 'react'
import { getActiveSchools, type SchoolDirectoryResult } from '@/lib/schools'

interface ActiveSchoolSelectProps {
  value: SchoolDirectoryResult | null
  onChange: (school: SchoolDirectoryResult | null) => void
}

function formatSchoolLabel(school: SchoolDirectoryResult): string {
  const location = [school.campus, school.city, school.state].filter(Boolean).join(', ')
  return location ? `${school.name} — ${location}` : school.name
}

export default function ActiveSchoolSelect({ value, onChange }: ActiveSchoolSelectProps) {
  const [schools, setSchools] = useState<SchoolDirectoryResult[]>([])
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getActiveSchools().then(setSchools)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = schools.filter((school) =>
    formatSchoolLabel(school).toLowerCase().includes(query.toLowerCase())
  )

  function selectSchool(school: SchoolDirectoryResult) {
    onChange(school)
    setQuery(formatSchoolLabel(school))
    setIsOpen(false)
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
        placeholder="Select your school"
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      {isOpen && filtered.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-brand-gray-200 bg-brand-white shadow-lg">
          {filtered.map((school) => (
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

      {isOpen && query.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-brand-gray-400">
          Zunio hasn&apos;t launched at your school yet.
        </p>
      )}
    </div>
  )
}
