'use client'

import { CATEGORIES, CONDITIONS, type Category, type Condition } from '@/lib/listings'
import { SlidersHorizontal, DollarSign } from 'lucide-react'
import { control } from '@/lib/ui-classes'
import SelectShell from './SelectShell'

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
  // Category moved to CategoryPills in the sticky bar; this hides the
  // duplicate select rather than having two controls fight over one value.
  hideCategory?: boolean
}

const PRICE_BUCKETS = [50, 100, 250, 500, 1000] as const

export default function FilterPanel({ filters, onChange, hideCategory = false }: FilterPanelProps) {
  // A filter shows as "active" when it is actually narrowing results, so the
  // control itself signals that the grid is filtered — otherwise a user who
  // scrolled past the bar can't tell why they're seeing fewer items.
  const conditionActive = filters.condition !== null
  const priceActive = filters.freeOnly || filters.maxPrice !== null

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {!hideCategory && (
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
      )}

      <SelectShell
        icon={<SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />}
        label={filters.condition ? CONDITION_LABELS[filters.condition] : 'Any condition'}
        active={conditionActive}
      >
        <select
          value={filters.condition ?? ''}
          aria-label="Filter by condition"
          onChange={(e) =>
            onChange({ ...filters, condition: (e.target.value || null) as Condition | null })
          }
          className={control.overlaySelect}
        >
          <option value="">Any condition</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
      </SelectShell>

      <SelectShell
        icon={<DollarSign className="h-4 w-4 shrink-0" aria-hidden />}
        label={
          filters.freeOnly
            ? 'Free items'
            : filters.maxPrice !== null
              ? `Under $${filters.maxPrice}`
              : 'Any price'
        }
        active={priceActive}
      >
        <select
          value={filters.freeOnly ? 'free' : filters.maxPrice ?? ''}
          aria-label="Filter by price"
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
          className={control.overlaySelect}
        >
          <option value="">Any price</option>
          <option value="free">Free items</option>
          {PRICE_BUCKETS.map((p) => (
            <option key={p} value={p}>
              Under ${p}
            </option>
          ))}
        </select>
      </SelectShell>
    </div>
  )
}
