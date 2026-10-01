import Link from 'next/link'
import LegalPage, { LegalList, type LegalSection } from '@/components/legal/LegalPage'
import { siteConfig } from '@/config/site'

export const metadata = {
  title: 'Terms of Service | Zunio',
  description: 'The agreement between you and Zunio.',
}

// PLACEHOLDERS requiring a human decision before launch are marked
// {{LIKE_THIS}} — see the launch checklist in info/BUILDORDER.md (2.13).
const SECTIONS: LegalSection[] = [
  {
    heading: 'What Zunio is',
    body: (
      <>
        <p>
          Zunio is a noticeboard. We let verified students at a campus list items and message
          each other. That is the whole service.
        </p>
        <p>
          <strong className="font-semibold text-brand-dark-brown">
            We are not a party to any transaction.
          </strong>{' '}
          We do not buy, sell, own, inspect, store, ship, or guarantee any item. We process no
          payments and hold no money. When you agree to buy something, that agreement is
          between you and the other student, and we are not part of it.
        </p>
      </>
    ),
  },
  {
    heading: 'Your account',
    body: (
      <>
        <p>
          You must be at least 18 and a student at a school we support. You are responsible for
          everything done through your account and for keeping your password secure. Tell us
          immediately if you think someone else has access.
        </p>
        <p>
          Posting listings requires a verified email address at the school you selected. We
          check that the domain of the address you verify matches that school&apos;s domain.
          This confirms a working school address — it is not an identity check, a background
          check, or a guarantee about the person.
        </p>
      </>
    ),
  },
  {
    heading: 'Listings',
    body: (
      <>
        <LegalList
          items={[
            'You may have up to 10 active listings at once.',
            'Listings expire 30 days after posting and can be renewed.',
            'You keep ownership of the photos and text you upload, and you grant us permission to display them on Zunio.',
            'You must have the right to sell what you list, and to use the photos you upload.',
            'We may remove any listing that breaks the Acceptable Use Policy, or that we reasonably believe is unsafe, unlawful, or fraudulent.',
          ]}
        />
        <p>
          What you may and may not list is set out in the{' '}
          <Link href="/aup" className="font-medium text-brand-blue hover:underline">
            Acceptable Use Policy
          </Link>
          , which forms part of these Terms.
        </p>
      </>
    ),
  },
  {
    heading: 'Transactions between students',
    body: (
      <>
        <p>
          You meet, inspect, and pay in person. Check an item before you hand over money. We do
          not offer escrow, buyer protection, refunds, or dispute resolution, and we cannot
          recover your money or your item if something goes wrong.
        </p>
        <p>
          You are responsible for your own taxes and for complying with your school&apos;s rules
          about selling on campus.
        </p>
      </>
    ),
  },
  {
    heading: 'Messages',
    body: (
      <p>
        Messages between students are private in the sense that no other user can read them.
        They are not private from us: we can access message content when investigating a report
        or where we are legally required to. How we handle that is described in the{' '}
        <Link href="/privacy" className="font-medium text-brand-blue hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    heading: 'Suspension and ending your account',
    body: (
      <>
        <p>
          You can stop using Zunio at any time and ask us to delete your account by emailing{' '}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-brand-blue hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
          .
        </p>
        <p>
          We may suspend or terminate an account that breaks these Terms or the Acceptable Use
          Policy, or where we reasonably believe someone is being put at risk. Where it is
          safe and practical to do so, we will tell you why.
        </p>
      </>
    ),
  },
  {
    heading: 'No warranty',
    body: (
      <p>
        Zunio is provided &ldquo;as is.&rdquo; We do not warrant that it will be uninterrupted
        or error-free, that listings are accurate, that items are as described, or that other
        users are who they say they are. To the fullest extent permitted by law we disclaim all
        implied warranties, including merchantability and fitness for a particular purpose.
      </p>
    ),
  },
  {
    heading: 'Limitation of liability',
    body: (
      <>
        <p>
          To the fullest extent permitted by law, Zunio and {'{{LEGAL_ENTITY}}'} are not liable
          for any indirect, incidental, special, or consequential damages, or for any loss
          arising out of a transaction, meeting, or interaction between users — including
          damaged, misdescribed, or undelivered items, and anything that happens at an in-person
          meetup.
        </p>
        <p>
          Our total liability for any claim relating to Zunio is limited to{' '}
          {'{{LIABILITY_CAP}}'}. Some jurisdictions do not allow these limits, in which case
          they apply only as far as the law permits.
        </p>
      </>
    ),
  },
  {
    heading: 'Changes and governing law',
    body: (
      <>
        <p>
          We may update these Terms. If a change is significant we will give notice in the app
          or by email. Continuing to use Zunio after a change means you accept the updated
          Terms.
        </p>
        <p>
          These Terms are governed by the laws of {'{{GOVERNING_LAW_STATE}}'}, without regard to
          conflict-of-law rules. Questions about these Terms go to{' '}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-brand-blue hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
          .
        </p>
      </>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="October 1, 2026"
      intro={
        <p>
          These Terms are the agreement between you and {'{{LEGAL_ENTITY}}'}, which operates
          Zunio. By creating an account or using Zunio you agree to them. Please read the
          sections on transactions and liability carefully — they explain what we are and are
          not responsible for.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
