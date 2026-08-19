'use client'

import { useEffect, useRef, useState } from 'react'

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
    <input
      type="text"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Search listings..."
      className="w-full max-w-sm rounded-md border border-brand-gray-200 bg-brand-white px-4 py-2.5 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
    />
  )
}
