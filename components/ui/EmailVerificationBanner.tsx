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
    .select('email_verified_at, is_seller_verified')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.is_seller_verified) return null

  const hasVerifiedAnyEmail = Boolean(profile.email_verified_at)

  return (
    <div className="flex items-center justify-center gap-2 bg-brand-emerald px-4 py-2.5 text-center text-sm font-medium text-brand-white">
      {hasVerifiedAnyEmail ? (
        <>
          <span>Add a school email to post listings.</span>
          <Link href="/account/add-school-email" className="underline underline-offset-2 hover:no-underline">
            Add school email
          </Link>
        </>
      ) : (
        <>
          <span>Verify your email to post listings.</span>
          <Link href="/check-email" className="underline underline-offset-2 hover:no-underline">
            Resend verification
          </Link>
        </>
      )}
    </div>
  )
}
