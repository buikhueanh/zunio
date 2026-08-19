'use client'

import { useEffect, useRef, useState } from 'react'
import { getActiveSchools, type SchoolDirectoryResult } from '@/lib/schools'

function formatSchoolLabel(school: SchoolDirectoryResult): string {
  const location = [school.campus, school.city, school.state].filter(Boolean).join(', ')
  return location ? `${school.name} — ${location}` : school.name
}

interface SchoolSwitcherProps {
  currentSchoolId: string
  currentLabel: string
  onSelect: (schoolId: string, label: string) => void
}

export default function SchoolSwitcher({
  currentSchoolId,
  currentLabel,
  onSelect,
}: SchoolSwitcherProps) {
  const [schools, setSchools] = useState<SchoolDirectoryResult[]>([])
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-md border border-brand-gray-200 bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald"
      >
        <span>{currentLabel}</span>
        <span className="text-brand-gray-400">▾</span>
      </button>

      {isOpen && (
        <ul className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-brand-gray-200 bg-brand-white shadow-lg">
          {schools.length === 0 && (
            <li className="px-4 py-3 text-sm text-brand-gray-400">Loading schools...</li>
          )}
          {schools.map((school) => (
            <li key={school.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(school.id, formatSchoolLabel(school))
                  setIsOpen(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm hover:bg-brand-emerald-light ${
                  school.id === currentSchoolId
                    ? 'font-semibold text-brand-emerald'
                    : 'text-brand-dark-brown'
                }`}
              >
                {formatSchoolLabel(school)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
