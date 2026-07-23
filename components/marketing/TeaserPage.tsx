import Image from 'next/image'
import Logo from '@/components/ui/Logo'
import WaitlistForm from '@/components/forms/WaitlistForm'

const HERO_IMAGE_URL = '/images/hero/teaser.png'

export default function TeaserPage() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-white px-6 py-10 md:px-16 md:py-14">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-brand-gray-100">
          <Image
            src={HERO_IMAGE_URL}
            alt="Students moving into a dorm"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col gap-6">
          <Logo size="sm" />

          <div className="flex flex-col gap-3">
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-brand-dark-brown md:text-5xl">
              Buy &amp; sell with{' '}
              <span className="italic text-brand-emerald">students</span> at your school
            </h1>
            <p className="max-w-md text-base text-brand-gray-500">
              Verified students. Campus pickup. Items you can actually trust. Join the
              waitlist! We&apos;ll email you the moment your school launches.
            </p>
          </div>

          <WaitlistForm />

          <p className="max-w-md text-xs text-brand-gray-400">
            We&apos;ll only email you about your school&apos;s launch. No spam, ever.
          </p>
        </div>
      </div>

      <footer className="mx-auto mt-16 flex w-full max-w-6xl items-center justify-between border-t border-brand-gray-200 pt-6">
        <p className="text-xs text-brand-gray-400">© 2026 Zunio. For students, by students.</p>
        <Logo size="md" />
      </footer>
    </div>
  )
}
