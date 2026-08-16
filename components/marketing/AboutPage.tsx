import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-white px-6 py-10 md:px-16 md:py-14">
      <div className="mx-auto w-full max-w-3xl flex-1">
        <Logo size="sm" />

        <h1 className="mt-8 font-display text-4xl font-extrabold leading-tight tracking-tight text-brand-dark-brown md:text-5xl">
          Meet the Founders
        </h1>

        <p className="mt-4 text-base text-brand-gray-500">
          Zunio was founded by Tanya Singh and Anh Bui.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-brand-emerald">About Tanya</h2>
          <p className="text-base text-brand-gray-600">
            Tanya is a senior at Northeastern University studying International Business with a
            concentration in Entrepreneurial Startups. Entrepreneurship has been at the heart of
            Tanya&rsquo;s journey from an early stage. She was recognized for Best Venture
            through Columbia University&rsquo;s Venture for All program and is also a recipient
            of Northeastern University&rsquo;s Global Women Who Empower Award, recognizing her
            leadership and impact within the university community.
          </p>
          <p className="text-base text-brand-gray-600">
            At Northeastern, Tanya serves as the Director of the Founder Development Program
            (Husky Startup Challenge) within the Entrepreneurs Club, where she works with
            aspiring student founders as they develop and validate their ventures. She has also
            served as a Teaching Assistant for multiple entrepreneurship professors, contributing
            to experiential entrepreneurship education both inside and outside the classroom.
          </p>
          <p className="text-base text-brand-gray-600">
            Alongside building Zunio, Tanya is currently writing her first book, continuing her
            broader interest in entrepreneurship, ambition, and building ideas into meaningful
            ventures.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-brand-emerald">About Anh Bui</h2>
          <p className="text-base text-brand-gray-600">
            Anh Bui is a recent graduate of DePauw University, where she double majored in
            Computer Science and Business Analytics and earned the Robert J. Thomas Outstanding
            Computer Science Senior Award, the department&apos;s top honor for graduating
            seniors. She&apos;s always gravitated toward problems that sit between the technical
            and the practical, building things that are real and also solve something people
            actually need.
          </p>
          <p className="text-base text-brand-gray-600">
            That instinct led her to co-create GrabBeforeGrad, a student resale marketplace she
            built and ran on Instagram with no outside funding. It reached 40,000 organic views
            in four days and sold half its inventory within the first week, entirely through word
            of mouth.
          </p>
          <p className="text-base text-brand-gray-600">
            She&apos;s also won at TigerHacks, received DePauw&apos;s School of Business
            Community Impact award, and placed in the top 25 out of a global field at
            Harvard&apos;s Global Case Competition. Alongside that, she built MindMitra, an
            AI-powered app for elderly users with cognitive decline that&apos;s live on the App
            Store, and worked as a software engineering intern at Parker Hannifin, where she
            built a full-stack internal search tool that cut search time by roughly 75% for over
            500 users.
          </p>
          <p className="text-base text-brand-gray-600">
            Anh moved to New York City after graduation and brings that same builder&apos;s
            instinct to Zunio: take a real, messy problem and ship something people will actually
            use.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-brand-gray-200 pt-8">
          <p className="text-base text-brand-gray-600">
            Together, the team looks forward to bringing Zunio to multiple university campuses in
            the coming months.
          </p>
          <p className="font-display text-lg font-bold text-brand-dark-brown">
            Stay tuned, zunio is just getting started.
          </p>
        </div>

        <Link
          href="/"
          className="mt-10 inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Back to home
        </Link>
      </div>

      <footer className="mx-auto mt-16 flex w-full max-w-3xl items-center justify-between border-t border-brand-gray-200 pt-6">
        <p className="text-xs text-brand-gray-400">© 2026 Zunio. For students, by students.</p>
        <Logo size="md" />
      </footer>
    </div>
  )
}
