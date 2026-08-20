import {
  LayoutGrid,
  Monitor,
  Sofa,
  BookOpen,
  Shirt,
  WashingMachine,
  Bike,
  Award,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/**
 * Category → icon. The design mockup used Lucide icons, so this maps to the
 * same set rather than approximating them with hand-written paths — one import
 * per icon, tree-shaken, instead of SVG markup pasted into components.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  electronics: Monitor,
  furniture: Sofa,
  textbooks: BookOpen,
  clothing: Shirt,
  appliances: WashingMachine,
  bikes: Bike,
  free: Award,
  other: Sparkles,
}

export function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category]
  if (!Icon) return null
  return <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
}
