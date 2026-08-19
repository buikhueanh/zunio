'use client'

import { CATEGORIES, CONDITIONS, type Category, type Condition } from '@/lib/listings'

const CATEGORY_LABELS: Record<Category, string> = {
  electronics: 'Electronics',
  furniture: 'Furniture',
  clothing: 'Clothing',
  textbooks: 'Textbooks',
  appliances: 'Appliances',
  bikes: 'Bikes',
  free: 'Free',
  other: 'Other',
}

const CONDITION_LABELS: Record<Condition, string> = {
  new: 'New',
  like_new: 'Like New',
  used: 'Used',
  for_parts: 'For Parts',
}

export interface FilterState {
  category: Category | null
  condition: Condition | null
  maxPrice: number | null
  freeOnly: boolean
}

interface FilterPanelProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const PRICE_BUCKETS = [50, 100, 250, 500, 1000] as const

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={filters.category ?? ''}
        onChange={(e) =>
          onChange({ ...filters, category: (e.target.value || null) as Category | null })
        }
        className="rounded-md border border-brand-gray-200 bg-brand-white px-3 py-2 text-sm text-brand-dark-brown outline-none focus:border-brand-emerald"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>

      <select
        value={filters.condition ?? ''}
        onChange={(e) =>
          onChange({ ...filters, condition: (e.target.value || null) as Condition | null })
        }
        className="rounded-md border border-brand-gray-200 bg-brand-white px-3 py-2 text-sm text-brand-dark-brown outline-none focus:border-brand-emerald"
      >
        <option value="">Any condition</option>
        {CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {CONDITION_LABELS[c]}
          </option>
        ))}
      </select>

      <select
        value={filters.freeOnly ? 'free' : filters.maxPrice ?? ''}
        onChange={(e) => {
          const value = e.target.value
          if (value === 'free') {
            onChange({ ...filters, freeOnly: true, maxPrice: null })
          } else if (value === '') {
            onChange({ ...filters, freeOnly: false, maxPrice: null })
          } else {
            onChange({ ...filters, freeOnly: false, maxPrice: Number(value) })
          }
        }}
        className="rounded-md border border-brand-gray-200 bg-brand-white px-3 py-2 text-sm text-brand-dark-brown outline-none focus:border-brand-emerald"
      >
        <option value="">Any price</option>
        <option value="free">Free items</option>
        {PRICE_BUCKETS.map((p) => (
          <option key={p} value={p}>
            Under ${p}
          </option>
        ))}
      </select>
    </div>
  )
}
