'use client'

import { ArrowUpNarrowWide } from 'lucide-react'
import type { SortOption } from '@/lib/listings'
import { control } from '@/lib/ui-classes'
import SelectShell from './SelectShell'

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
    <SelectShell
      icon={<ArrowUpNarrowWide className="h-4 w-4 shrink-0" aria-hidden />}
      label={SORT_LABELS[value]}
      active={value !== 'newest'}
    >
      <select
        value={value}
        disabled={disabled}
        aria-label="Sort listings"
        onChange={(e) => onChange(e.target.value as SortOption)}
        className={control.overlaySelect}
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </SelectShell>
  )
}
