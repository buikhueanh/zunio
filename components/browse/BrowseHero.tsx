'use client'

import Image from 'next/image'
import type { ReactNode, RefObject } from 'react'
import { CircleCheckBig, MapPin, ShieldCheck } from 'lucide-react'

const TRUST_POINTS = [
  { Icon: CircleCheckBig, label: 'Verified students only' },
  { Icon: MapPin, label: 'Campus pickup' },
  { Icon: ShieldCheck, label: 'No strangers, no scams' },
] as const

const HERO_IMAGE_URL = '/images/hero/teaser.png'

/**
 * The full marketing hero, rendered for logged-out visitors only.
 *
 * Height is deliberately capped so the first row of listings peeks above the
 * fold — a hero that fills the viewport reads as a brochure, and visitors
 * bounce without learning there is real inventory. That matters most at launch,
 * when the feeds are thin: showing three real items beats a beautiful empty
 * page.
 */
export default function BrowseHero({
  search,
  schoolSwitcher,
  controlsSentinelRef,
}: {
  search: ReactNode
  schoolSwitcher: ReactNode
  // Sits directly below the controls below; the browse page observes it to
  // decide when the sticky bar should take over.
  controlsSentinelRef?: RefObject<HTMLDivElement>
}) {
  return (
    <section className="relative flex flex-col overflow-hidden md:h-[440px] md:flex-row">
      <div className="relative z-[2] flex w-full flex-col justify-center bg-brand-emerald px-6 py-10 md:w-[46%] md:px-12 md:py-0">
        {/* The angled edge from the design: a skewed block extending past the
            panel's right edge, so the emerald cuts diagonally into the photo.
            Desktop only — on mobile the panel stacks above the image and a
            diagonal would just clip the text. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-24 translate-x-[70%] skew-x-[-8deg] bg-brand-emerald md:block"
        />
        <span className="relative z-10 mb-4 inline-flex w-fit items-center gap-2 rounded-md bg-brand-white/10 px-3.5 py-2 text-xs font-semibold tracking-wide text-brand-cream backdrop-blur-sm">
          <CircleCheckBig className="h-3.5 w-3.5" aria-hidden />
          Verified student marketplace
        </span>

        <h1 className="relative z-10 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-brand-white md:text-[42px]">
          Buy &amp; sell with <span className="text-brand-cream">students</span> at your school
        </h1>

        <p className="relative z-10 mt-3 max-w-md text-base text-brand-white/75">
          Verified students. Campus pickup. Items you can actually trust.
        </p>

        {/* z-20, above the sibling blocks' z-10: the school dropdown opens
            downward out of this container, and with equal z-index the later
            siblings (the trust row) would paint over it. z-index only
            competes within a stacking context, so the dropdown's own z-20
            cannot escape this parent — the parent has to outrank them. */}
        <div className="relative z-20 mt-6 flex max-w-md flex-col gap-3">
          {search}
          {schoolSwitcher}
        </div>
        {/* Marks the bottom edge of the hero's controls. Once this scrolls out
            of view the sticky bar shows its own copies, so the two are never
            visible at the same time. */}
        <div ref={controlsSentinelRef} aria-hidden className="h-px w-full" />

        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          {TRUST_POINTS.map(({ Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-white/65"
            >
              <Icon className="h-3.5 w-3.5 text-brand-cream" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-56 w-full overflow-hidden bg-brand-gray-100 md:h-auto md:w-[54%]">
        <Image
          src={HERO_IMAGE_URL}
          alt="Students moving into a dorm"
          fill
          sizes="(max-width: 768px) 100vw, 54vw"
          className="object-cover"
          priority
        />
        {/* Mobile only: softens the seam where the stacked panel meets the
            photo. On desktop the skewed block above provides a hard diagonal
            edge instead, so a gradient there would muddy it. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand-emerald to-transparent md:hidden" />
      </div>
    </section>
  )
}
