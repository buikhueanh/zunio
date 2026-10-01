import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { control, cx } from '@/lib/ui-classes'

/**
 * Wraps a native <select> so it can carry a leading icon and a styled chevron.
 *
 * A native select cannot contain markup, so the icons are siblings and the
 * select itself is transparent and stretched over the top. That keeps real
 * native behaviour — keyboard handling and the OS wheel picker on mobile —
 * instead of reimplementing a listbox purely for decoration.
 */
export default function SelectShell({
  icon,
  label,
  active = false,
  children,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <span className={cx(control.base, active ? control.active : control.inactive)}>
      {icon}
      <span>{label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-brand-gray-400" aria-hidden />
      {children}
    </span>
  )
}
