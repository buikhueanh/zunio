/**
 * Shared Tailwind class strings.
 *
 * Colours, radii and shadows live in styles/globals.css as design tokens; this
 * file is the layer above that — the recurring *combinations* that make up a
 * pill, a chip, a control. Without it the same twelve-class string gets pasted
 * into five components and they drift apart one tweak at a time.
 *
 * Rule of thumb: a literal class string belongs in a component only when it is
 * genuinely one-off layout (a grid template, a specific gap). Anything that
 * describes a repeated *thing* belongs here.
 */

/** Rounded action buttons (nav "Sell Item", primary CTAs). */
export const button = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-brand-emerald px-5 py-2.5 text-sm font-semibold text-brand-white shadow-sm transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50',
  outlineBlue:
    'inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue px-5 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-brand-white',
  /** Square-ish hit area for icon-only nav actions. */
  icon: 'flex h-10 w-10 items-center justify-center rounded-full text-brand-gray-600 transition hover:bg-brand-emerald-light hover:text-brand-emerald',
  ghost:
    'rounded-md px-4 py-2 text-sm font-medium text-brand-gray-600 transition hover:bg-brand-emerald-light hover:text-brand-emerald',
} as const

/** Category filter pills. */
export const pill = {
  base: 'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium transition',
  inactive:
    'border-brand-gray-200 bg-brand-white text-brand-gray-600 hover:border-brand-emerald hover:bg-brand-emerald-light hover:text-brand-emerald',
  active: 'border-brand-emerald bg-brand-emerald text-brand-white shadow-sm',
  /** "Free" reads differently from a normal category, so it gets the blue accent. */
  activeAccent: 'border-brand-blue bg-brand-blue text-brand-white shadow-sm',
} as const

/** The shell around a native <select> so it can carry an icon and chevron. */
export const control = {
  base: 'relative inline-flex items-center gap-2 rounded-full border bg-brand-white py-2 pl-4 pr-3 text-sm font-medium transition',
  inactive:
    'border-brand-gray-200 text-brand-gray-600 hover:border-brand-blue hover:text-brand-blue',
  active: 'border-brand-blue text-brand-blue',
  /** The real <select>, transparent and stretched over the shell. */
  overlaySelect: 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed',
} as const

/** Text inputs. */
export const field =
  'w-full rounded-md border border-brand-gray-200 bg-brand-white px-4 py-3 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light'

/** Small read-only attribute chips on listing cards. */
export const chip =
  'rounded-md border border-brand-gray-200 px-2 py-1 text-[11px] font-medium text-brand-gray-600'

/** Corner badges on listing card images. */
export const badge = {
  base: 'absolute left-3 top-3 flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-white',
  free: 'bg-brand-emerald',
  verified: 'bg-brand-blue',
  new: 'bg-brand-light-brown',
} as const

/** Absolutely-positioned dropdown panel (school switcher, future menus). */
export const dropdownPanel =
  'absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-brand-gray-200 bg-brand-white shadow-lg'

export const dropdownItem = 'block w-full px-4 py-3 text-left text-sm hover:bg-brand-emerald-light'

/** Joins conditional class strings, dropping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
