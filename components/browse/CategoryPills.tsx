'use client'

import { LISTING_CATEGORIES, FREE_CATEGORY } from '@/lib/validations'
import { CATEGORY_LABELS } from '@/lib/listing-format'
import type { Category } from '@/lib/listings'
import { CategoryIcon } from './CategoryIcons'
import { pill, cx } from '@/lib/ui-classes'

/**
 * Horizontal category filter. Replaces the old <select> — pills show every
 * option at once, which matters on a marketplace where browsing by category is
 * the primary way people navigate a feed they haven't seen before.
 */
export default function CategoryPills({
  value,
  onChange,
}: {
  value: Category | null
  onChange: (category: Category | null) => void
}) {
  return (
    <div
      role="group"
      aria-label="Filter by category"
      // Scrollbar hidden but scrolling preserved — the row overflows on phones.
      className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cx(pill.base, value === null ? pill.active : pill.inactive)}
      >
        <CategoryIcon category="all" />
        All
      </button>

      {LISTING_CATEGORIES.map((category) => {
        const active = value === category
        // "Free" gets the blue accent so a giveaway reads differently from a
        // normal category selection at a glance.
        const activeClass = category === FREE_CATEGORY ? pill.activeAccent : pill.active

        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(active ? null : (category as Category))}
            aria-pressed={active}
            className={cx(pill.base, active ? activeClass : pill.inactive)}
          >
            <CategoryIcon category={category} />
            {CATEGORY_LABELS[category] ?? category}
          </button>
        )
      })}
    </div>
  )
}
