import { CircleCheckBig, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react'

const CARDS: Array<{ title: string; body: string; Icon: LucideIcon }> = [
  {
    title: 'Verified Students',
    body: 'Every seller uses a university email. No randoms, no strangers — just people from your school.',
    Icon: CircleCheckBig,
  },
  {
    title: 'Campus Pickup',
    body: 'Meet in public spots at your school. No shipping, no driving across town — just walk to the library.',
    Icon: MapPin,
  },
  {
    title: 'Good Condition',
    body: 'Buy from students who actually used the item. See it in person before you pay. No surprises.',
    Icon: ShieldCheck,
  },
]

/**
 * Why-trust-us cards. Rendered for LOGGED-OUT visitors only — this is
 * conversion material for someone deciding whether Zunio is legitimate, and a
 * student who already signed up scrolling past "every seller uses a university
 * email" on every visit is just noise. Crawlers see it, so no SEO cost.
 */
export default function TrustSection() {
  return (
    <section className="border-t border-brand-gray-200 bg-brand-cream-light px-6 py-16 md:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-blue">
            Why students choose Zunio
          </h2>
          <p className="mt-2 text-base text-brand-gray-500">
            Built for campus life. Built for trust.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CARDS.map(({ title, body, Icon }) => (
            <div
              key={title}
              className="relative overflow-hidden rounded-lg bg-brand-blue p-8 text-center transition hover:-translate-y-1 hover:bg-brand-blue-light hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-brand-white/10 text-brand-cream">
                <Icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="font-display text-lg font-bold text-brand-white">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-brand-white/75">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
