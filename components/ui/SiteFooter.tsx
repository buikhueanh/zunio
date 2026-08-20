import Link from 'next/link'
import Logo from '@/components/ui/Logo'

// A gradient of dots bridging the blue trust section into the emerald footer.
const BRIDGE_DOTS = [
  'bg-brand-blue',
  'bg-[#2e5a82]',
  'bg-[#3a6e8f]',
  'bg-[#4d827a]',
  'bg-[#3d7a64]',
  'bg-[#2e6e52]',
  'bg-brand-emerald',
]

/**
 * Site footer. Rendered for EVERY viewer, signed in or not — unlike the trust
 * cards, this carries Terms, Privacy and Contact, which have to stay reachable
 * from every page for every user.
 */
export default function SiteFooter({ showBridge = false }: { showBridge?: boolean }) {
  return (
    <>
      {showBridge && (
        <div aria-hidden className="flex items-center justify-center gap-2.5 py-8">
          {BRIDGE_DOTS.map((color, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${color}`} />
          ))}
        </div>
      )}

      <footer className="bg-brand-emerald px-6 py-12 md:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">
          <Logo size="md" variant="reversed" />

          <nav className="flex flex-wrap items-center justify-center gap-7 text-sm font-medium">
            <Link href="/about" className="text-brand-white/65 transition hover:text-brand-cream">
              About
            </Link>
            <a
              href="mailto:hello@zunio.org"
              className="text-brand-white/65 transition hover:text-brand-cream"
            >
              Contact
            </a>
            <Link href="/terms" className="text-brand-white/65 transition hover:text-brand-cream">
              Terms
            </Link>
            <Link href="/privacy" className="text-brand-white/65 transition hover:text-brand-cream">
              Privacy
            </Link>
          </nav>

          <p className="text-xs text-brand-white/50">
            © 2026 Zunio. For students, by students.
          </p>
        </div>
      </footer>
    </>
  )
}
