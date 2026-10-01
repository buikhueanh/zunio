import Link from 'next/link'
import type { ReactNode } from 'react'
import Logo from '@/components/ui/Logo'
import SiteFooter from '@/components/ui/SiteFooter'

export type LegalSection = {
  heading: string
  body: ReactNode
}

/**
 * Shared chrome and typography for the policy pages.
 *
 * One component rather than three near-identical pages: legal text gets
 * amended, and three copies of the layout drift apart the first time one is
 * touched. Content lives in each route; everything visual lives here.
 */
export default function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string
  lastUpdated: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-cream-light">
      <header className="border-b border-brand-gray-200 bg-brand-white px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
            Back to Zunio
          </Link>
        </div>
      </header>

      <main className="w-full flex-1 px-6 py-10 md:px-10">
        <article className="mx-auto w-full max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand-dark-brown md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-brand-gray-400">Last updated {lastUpdated}</p>

          <div className="mt-6 text-base leading-relaxed text-brand-gray-600">{intro}</div>

          <div className="mt-10 flex flex-col gap-9">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-lg font-bold text-brand-dark-brown">
                  {section.heading}
                </h2>
                <div className="mt-2.5 flex flex-col gap-3 text-base leading-relaxed text-brand-gray-600">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <nav className="mt-14 flex flex-wrap gap-5 border-t border-brand-gray-200 pt-6 text-sm font-medium">
            <Link href="/terms" className="text-brand-blue hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-brand-blue hover:underline">
              Privacy Policy
            </Link>
            <Link href="/aup" className="text-brand-blue hover:underline">
              Acceptable Use Policy
            </Link>
          </nav>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

/** Bulleted list with the spacing the policy pages use. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
