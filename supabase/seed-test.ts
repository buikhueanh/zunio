/**
 * Creates (or removes) throwaway accounts + listings for manual testing.
 *
 *   npm run seed:test         create test users and listings
 *   npm run seed:test:clean   delete everything this script created
 *
 * These write to the REAL Supabase project — there is no separate dev database.
 * Everything created is tagged with TEST_PREFIX and the cleanup only ever
 * deletes accounts whose email starts with it, so real users can't be caught.
 *
 * Accounts are created pre-verified via the Admin API, which skips the
 * verification email entirely — otherwise every test run would burn Resend
 * quota that sign-up in production depends on.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// Plus-addressing on a real inbox, so message-notification emails actually
// arrive and you can check how they look. Change this to your own address —
// sending to a nonexistent @zunio.org address bounces and, repeated, hurts
// the domain's sending reputation.
const INBOX = process.env.TEST_INBOX ?? 'anhkhuebui.work@gmail.com'

const TEST_PREFIX = 'zunio-test'
const PASSWORD = 'TestPassword123!'
const NORTHEASTERN_SLUG = 'northeastern-boston'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function testEmail(tag: string) {
  const [local, domain] = INBOX.split('@')
  return `${local}+${TEST_PREFIX}-${tag}@${domain}`
}

const PEOPLE = [
  { tag: 'seller', first: 'Sam', last: 'Seller', username: 'zuniotestseller' },
  { tag: 'buyer', first: 'Bea', last: 'Buyer', username: 'zuniotestbuyer' },
]

const LISTINGS = [
  { title: 'Desk Lamp (test)', description: 'Warm light, barely used. Test listing.', price: 15, category: 'furniture', condition: 'like_new' },
  { title: 'Free Moving Boxes (test)', description: 'Ten sturdy boxes, free to a good home. Test listing.', price: null, category: 'free', condition: 'used' },
  { title: 'Mountain Bike (test)', description: '21 speed, new brake pads. Test listing.', price: 220, category: 'bikes', condition: 'used' },
]

async function seed() {
  // Idempotent: re-running otherwise fails with "already been registered" and
  // leaves you to figure out that you need to clean first.
  await clean()

  const { data: school } = await supabase
    .from('schools')
    .select('id')
    .eq('slug', NORTHEASTERN_SLUG)
    .single()

  if (!school) throw new Error(`No active school with slug ${NORTHEASTERN_SLUG}`)

  const created: Record<string, string> = {}

  for (const person of PEOPLE) {
    const email = testEmail(person.tag)

    const { data: auth, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (authError) throw new Error(`auth create failed for ${email}: ${authError.message}`)

    const userId = auth.user!.id
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      first_name: person.first,
      last_name: person.last,
      username: person.username,
      school_id: school.id,
      contact_email: email,
      // Pre-verified so you can post immediately without the email round trip.
      is_seller_verified: true,
      email_verified_at: new Date().toISOString(),
    })
    if (profileError) throw new Error(`profile insert failed for ${email}: ${profileError.message}`)

    created[person.tag] = userId
    console.log(`  created ${person.first} ${person.last}  ${email}`)
  }

  for (const listing of LISTINGS) {
    const { error } = await supabase.from('listings').insert({
      user_id: created.seller,
      school_id: school.id,
      images: [],
      ...listing,
    })
    if (error) throw new Error(`listing insert failed: ${error.message}`)
  }
  console.log(`  created ${LISTINGS.length} listings owned by the seller`)

  console.log('\nSign in with:')
  console.log(`  SELLER  ${testEmail('seller')}`)
  console.log(`  BUYER   ${testEmail('buyer')}`)
  console.log(`  password (both): ${PASSWORD}`)
  console.log('\nNote: both accounts are pre-verified, so they can post and message right away.')
}

async function clean() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  const targets = (data?.users ?? []).filter((u) => u.email?.includes(`+${TEST_PREFIX}-`))

  if (targets.length === 0) {
    console.log('  nothing to clean')
    return
  }

  for (const user of targets) {
    // Conversations this user started, plus any they merely participate in.
    const { data: convos } = await supabase.from('conversations').select('id').eq('buyer_id', user.id)
    for (const convo of convos ?? []) {
      await supabase.from('messages').delete().eq('conversation_id', convo.id)
      await supabase.from('conversation_participants').delete().eq('conversation_id', convo.id)
      await supabase.from('conversations').delete().eq('id', convo.id)
    }
    await supabase.from('conversation_participants').delete().eq('user_id', user.id)
    await supabase.from('messages').delete().eq('sender_id', user.id)
    await supabase.from('listings').delete().eq('user_id', user.id)
    await supabase.from('email_verifications').delete().eq('user_id', user.id)
    await supabase.from('users').delete().eq('id', user.id)
    await supabase.auth.admin.deleteUser(user.id)
    console.log(`  removed ${user.email}`)
  }
}

async function main() {
  const mode = process.argv[2] === 'clean' ? 'clean' : 'seed'
  console.log(mode === 'clean' ? 'Removing test data...' : 'Seeding test data...')
  await (mode === 'clean' ? clean() : seed())
  console.log('Done.')
}

main().catch((err) => {
  console.error('FAILED:', err.message ?? err)
  process.exit(1)
})
