import LegalPage, { LegalList, type LegalSection } from '@/components/legal/LegalPage'
import { siteConfig } from '@/config/site'

export const metadata = {
  title: 'Acceptable Use Policy | Zunio',
  description: 'What you may and may not list or do on Zunio.',
}

// NOTE: the prohibited-items list is the one CLAUDE.md specifies. The listing
// form's required checkbox points here, so this page is what that checkbox
// actually commits a seller to — keep the two in sync if either changes.
const SECTIONS: LegalSection[] = [
  {
    heading: 'Who can use Zunio',
    body: (
      <>
        <p>
          Zunio is for university students. Browsing and messaging require an account. Posting
          a listing additionally requires a verified email address at the school you selected
          when you signed up.
        </p>
        <p>
          You must be at least 18 years old to use Zunio. You may only hold one account, and
          you may not create an account on someone else&apos;s behalf or pretend to be someone
          you are not.
        </p>
      </>
    ),
  },
  {
    heading: 'Items you may not list',
    body: (
      <>
        <p>You may not list, offer, or arrange to hand over any of the following:</p>
        <LegalList
          items={[
            'Weapons of any kind, including replicas, ammunition, and parts',
            'Controlled substances, drugs, and drug paraphernalia',
            'Prescription medication, including unopened or unused medication',
            'Alcohol and tobacco or vaping products',
            'Adult or sexually explicit content or services',
            'Counterfeit goods, replicas sold as genuine, or stolen property',
            'Live animals',
            'Anything you do not actually own and have the right to sell',
            'Anything whose sale or transfer is illegal where the handover happens',
          ]}
        />
        <p>
          Academic integrity matters here too: you may not sell completed coursework, exam
          answers, or anything else intended to help someone cheat. Your school&apos;s own
          policies apply to you independently of ours.
        </p>
      </>
    ),
  },
  {
    heading: 'How you must behave',
    body: (
      <>
        <LegalList
          items={[
            'Describe items honestly, including flaws. Use your own photos of the actual item.',
            'List a real price you intend to honor. Do not use listings to advertise something else.',
            'Do not harass, threaten, demean, or sexually solicit anyone, in messages or listings.',
            'Do not spam — mass-messaging sellers or posting the same item repeatedly.',
            'Do not scrape, automate, or attempt to break, probe, or overload the service.',
            'Do not use Zunio to arrange anything prohibited above, even if the listing itself looks harmless.',
          ]}
        />
      </>
    ),
  },
  {
    heading: 'Meeting in person',
    body: (
      <>
        <p>
          Zunio is built around campus pickup. We do not handle payment, delivery, escrow, or
          returns, and we are not present at your meetup. Those arrangements are entirely
          between you and the other person.
        </p>
        <p>
          We strongly recommend meeting in a public, well-trafficked place on campus during
          daylight hours, telling someone where you are going, and not entering a stranger&apos;s
          residence. Trust your instincts and leave if something feels wrong.
        </p>
      </>
    ),
  },
  {
    heading: 'Reporting and enforcement',
    body: (
      <>
        <p>
          Every listing has a report link. If you see something that breaks this policy, report
          it or email{' '}
          <a
            href={`mailto:${siteConfig.moderationEmail}`}
            className="font-medium text-brand-blue hover:underline"
          >
            {siteConfig.moderationEmail}
          </a>
          . If you are in immediate danger, contact campus security or local emergency services
          first — we cannot respond in real time.
        </p>
        <p>
          When a report is valid we may remove a listing, suspend or delete an account, and
          where appropriate notify the school or law enforcement. We review reports manually,
          which means response times vary. We may act without prior notice when someone&apos;s
          safety is involved.
        </p>
      </>
    ),
  },
  {
    heading: 'Changes',
    body: (
      <p>
        We may update this policy as Zunio grows or as new problems come up. Continuing to use
        Zunio after a change means you accept the updated policy.
      </p>
    ),
  },
]

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      lastUpdated="October 1, 2026"
      intro={
        <p>
          Zunio works because students trust the person on the other side of a listing. This
          policy sets out what you may list, how you must behave, and what happens when someone
          breaks those rules. It applies to everyone, and you agree to it each time you post a
          listing.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
