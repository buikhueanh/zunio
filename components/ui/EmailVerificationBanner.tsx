import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function EmailVerificationBanner() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('email_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  const isUnverified = profile !== null && !profile.email_verified_at
  if (!isUnverified) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-brand-emerald px-4 py-2.5 text-center text-sm font-medium text-brand-white">
      <span>Verify your email to post listings.</span>
      <Link href="/check-email" className="underline underline-offset-2 hover:no-underline">
        Resend verification
      </Link>
    </div>
  )
}
