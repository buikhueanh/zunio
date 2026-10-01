'use client'

import { useEffect, useRef, useState } from 'react'
import { getActiveSchools, type SchoolDirectoryResult } from '@/lib/schools'
import { dropdownPanel, dropdownItem, cx, CONTROL_HEIGHT } from '@/lib/ui-classes'

function formatSchoolLabel(school: SchoolDirectoryResult): string {
  const location = [school.campus, school.city, school.state].filter(Boolean).join(', ')
  return location ? `${school.name} — ${location}` : school.name
}

interface SchoolSwitcherProps {
  currentSchoolId: string
  currentLabel: string
  onSelect: (schoolId: string, label: string) => void
  // 'onDark' is used inside the emerald hero panel, where the default
  // light-on-white trigger would be invisible.
  variant?: 'default' | 'onDark'
}

export default function SchoolSwitcher({
  currentSchoolId,
  currentLabel,
  onSelect,
  variant = 'default',
}: SchoolSwitcherProps) {
  const triggerClass =
    variant === 'onDark'
      ? `flex w-fit items-center gap-2 ${CONTROL_HEIGHT} rounded-md border-[1.5px] border-brand-white/25 bg-brand-white/15 px-4 text-sm font-semibold text-brand-cream backdrop-blur-sm transition hover:border-brand-white/40 hover:bg-brand-white/25`
      : `flex items-center gap-2 ${CONTROL_HEIGHT} rounded-md border border-brand-gray-200 bg-brand-white px-4 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald`
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

  // w-fit makes the wrapper hug the trigger button, so the dropdown's w-full
  // resolves to "same width as the trigger" instead of a fixed size that
  // rarely matches it.
  return (
    <div ref={containerRef} className="relative w-fit">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClass}
      >
        <span>{currentLabel}</span>
        <span className={variant === 'onDark' ? 'text-brand-cream/70' : 'text-brand-gray-400'}>▾</span>
      </button>

      {isOpen && (
        <ul className={dropdownPanel}>
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
                className={cx(
                  dropdownItem,
                  school.id === currentSchoolId
                    ? 'font-semibold text-brand-emerald'
                    : 'text-brand-dark-brown'
                )}
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
