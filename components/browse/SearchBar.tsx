'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { field } from '@/lib/ui-classes'

interface SearchBarProps {
  value: string
  onChange: (query: string) => void
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [draft, setDraft] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => setDraft(value), [value])

  function handleChange(next: string) {
    setDraft(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(next), 300)
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search listings..."
        aria-label="Search listings"
        // Extra right padding reserves room for the trailing icon so long
        // queries don't run underneath it.
        className={`${field} pr-11`}
      />
      <Search
        className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-brand-gray-400"
        aria-hidden
      />
    </div>
  )
}
