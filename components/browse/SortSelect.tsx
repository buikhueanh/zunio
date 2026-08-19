'use client'

import type { SortOption } from '@/lib/listings'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
}

interface SortSelectProps {
  value: SortOption
  onChange: (sort: SortOption) => void
  disabled?: boolean
}

export default function SortSelect({ value, onChange, disabled }: SortSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="rounded-md border border-brand-gray-200 bg-brand-white px-3 py-2 text-sm text-brand-dark-brown outline-none focus:border-brand-emerald disabled:cursor-not-allowed disabled:opacity-50"
    >
      {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
