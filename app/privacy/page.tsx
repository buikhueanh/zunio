import LegalPage, { LegalList, type LegalSection } from '@/components/legal/LegalPage'
import { siteConfig } from '@/config/site'

export const metadata = {
  title: 'Privacy Policy | Zunio',
  description: 'What Zunio collects, why, and who can see it.',
}

// Every claim below reflects what the code actually does today. If the product
// changes, this page changes with it — a privacy policy that overstates what we
// protect is worse than none.
const SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body: (
      <>
        <p>When you join the waitlist, we store your email address and the school you chose.</p>
        <p>When you create an account, we store:</p>
        <LegalList
          items={[
            'Your first name, optional last name, and the username you pick',
            'Your email address, and any school email you later add to unlock selling',
            'The school you selected',
            'A password, stored only as a hash by our authentication provider — we never see it',
          ]}
        />
        <p>When you use Zunio, we store the listings you post, the photos you upload, and the messages you send.</p>
      </>
    ),
  },
  {
    heading: 'What other people can see',
    body: (
      <>
        <p>
          Public, to anyone: your first and last name, your username, your school, and any
          listing you post including its photos and description.
        </p>
        <p>
          <strong className="font-semibold text-brand-dark-brown">
            Your email address is never shown to other users.
          </strong>{' '}
          Messaging happens inside Zunio precisely so you do not have to hand your address to a
          stranger to arrange a sale.
        </p>
      </>
    ),
  },
  {
    heading: 'Photos and location data',
    body: (
      <p>
        Photos taken on a phone normally carry hidden metadata, often including the exact GPS
        coordinates where the photo was taken. Zunio strips that metadata from every photo
        before it is uploaded — we re-encode the image in your browser, so only the picture
        itself ever reaches our servers. A photo of a desk in your room does not reveal where
        you live.
      </p>
    ),
  },
  {
    heading: 'Messages',
    body: (
      <>
        <p>
          Messages are private from other users — only you and the person you are talking to can
          read a conversation, and this is enforced at the database level, not just in the app.
        </p>
        <p>
          They are not private from us. We can access message content when investigating a
          safety report, when required by law, or when necessary to protect someone. We do not
          read messages routinely, and we do not use them for advertising or sell them.
        </p>
        <p>
          Messages are kept for as long as your account exists. There is currently no way to
          delete an individual message once sent.
        </p>
      </>
    ),
  },
  {
    heading: 'Why we use your information',
    body: (
      <LegalList
        items={[
          'To run the service — showing listings, delivering messages, signing you in',
          'To confirm you are a student at the school you claim, which is the basis of the whole product',
          'To send transactional email: verification links and notifications that someone messaged you',
          'To investigate reports and keep people safe',
        ]}
      />
    ),
  },
  {
    heading: 'Email',
    body: (
      <p>
        We send verification emails, message notifications, and — if you joined the waitlist —
        an email when your school launches. We do not sell your address or send marketing on
        behalf of anyone else. Notification emails are throttled so an active conversation does
        not flood your inbox.
      </p>
    ),
  },
  {
    heading: 'Who we share it with',
    body: (
      <>
        <p>
          We do not sell your personal information. We share it only with the providers that run
          Zunio for us:
        </p>
        <LegalList
          items={[
            'Supabase — database, authentication, and photo storage',
            'Vercel — hosting and delivery of the site',
            'Resend — sending email',
          ]}
        />
        <p>
          We may also disclose information where legally required, or where necessary to
          investigate a safety report or protect someone from harm.
        </p>
      </>
    ),
  },
  {
    heading: 'Cookies',
    body: (
      <p>
        We use cookies only to keep you signed in. We do not use advertising or third-party
        tracking cookies, and we do not run analytics that profile you across other websites.
      </p>
    ),
  },
  {
    heading: 'Your choices',
    body: (
      <>
        <p>
          You can ask us for a copy of your data, ask us to correct it, or ask us to delete your
          account by emailing{' '}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-brand-blue hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
          . We handle these manually, so allow a few days.
        </p>
        <p>
          When an account is deleted we remove your profile and listings from Zunio. Messages
          you sent may remain visible to the people you sent them to, since a conversation
          belongs to both sides. We may retain records where we are legally required to, or
          where needed to resolve an open safety report.
        </p>
        <p>
          Depending on where you live, you may have additional rights under laws such as the
          GDPR or the CCPA. Write to the same address and we will honor them.
        </p>
      </>
    ),
  },
  {
    heading: 'Changes and contact',
    body: (
      <p>
        If we change how we handle your information we will update this page and, for
        significant changes, tell you directly. Questions go to{' '}
        <a
          href={`mailto:${siteConfig.supportEmail}`}
          className="font-medium text-brand-blue hover:underline"
        >
          {siteConfig.supportEmail}
        </a>
        . Zunio is operated by {'{{LEGAL_ENTITY}}'}.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="October 1, 2026"
      intro={
        <p>
          Zunio is built on students trusting each other, so being straight about what we
          collect matters. This page explains what we store, who can see it, and what control
          you have. It describes what the product actually does today — not what we might do
          later.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
