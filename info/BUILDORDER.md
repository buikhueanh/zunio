# Zunio — Build Order

Read this at the start of every session. Work through items in order within each phase. Do not start a phase until the previous phase is complete and deployed.

When an item is complete, mark it `[x]`. When you start an item, note it in a comment.

---

## Current phase: PHASE 0 — Teaser Page

**Goal:** Live URL collecting waitlist signups before a line of the main app is written.
**Deploy target:** Production domain, as soon as possible.
**Success criteria:** Email + school submission works end-to-end. Confirmation email sends. Signup visible in Supabase waitlist table.

```
[x] 0.1  Download and filter IPEDS HD2023.csv
         Filter: ICLEVEL=1 (4-year), CONTROL IN (1,2) (public + private non-profit)
         Save as: lib/data/schools_directory.csv
         Expected rows: ~2,800 — actual: 2,510 (HD2023 count for this filter)
         Columns: name, campus (empty — IPEDS has no campus split), city, state, ipeds_id, domain (derived from WEBADDR)

[x] 0.2  Supabase project setup
         - Create project at supabase.com
         - Copy keys to .env.local (see .env.local.example)
         - Install Supabase CLI: npm install supabase --save-dev
         - CLI linked to project ref qnnkridxlsvjelywbzwh

[x] 0.3  Database migrations — run in order
         supabase/migrations/001_schools_directory.sql
         supabase/migrations/002_schools.sql
         supabase/migrations/003_waitlist.sql
         Apply via: supabase db push

[x] 0.4  Seed schools_directory from CSV
         supabase/seed.ts — reads lib/data/schools_directory.csv, bulk inserts
         Seed active schools table with initial launch campuses (Northeastern Boston at minimum)
         Run via: npm run seed (wraps ts-node with supabase/tsconfig.seed.json, which
         forces commonjs — repo's root tsconfig targets esnext, which confuses ts-node's
         ESM auto-detection when invoked directly)
         Verified: schools_directory has 2,510 rows, schools has 1 active row (northeastern-boston)

[x] 0.5  POST /api/waitlist route
         Validates email (Zod), school_id (uuid, nullable), school_name_raw (string, nullable)
         Inserts into waitlist table
         Handles duplicate email (error code 23505) → return success silently
         Sends confirmation email via Resend on success
         Uses service role key (reads/writes bypass RLS)
         Files: app/api/waitlist/route.ts, lib/validations.ts, lib/resend.ts
         Tested end-to-end against live Supabase: invalid input (400), missing school (400),
         valid signup with school_name_raw, valid signup with school_id, duplicate email
         returns success silently with no second row. Test rows cleaned up after.
         RESEND_API_KEY set 2026-07-09. Confirmation email send verified end-to-end via
         Resend's sandbox sender (onboarding@resend.dev) — real send accepted, id returned.
         from address in lib/resend.ts hits `hello@zunio.app` (updated from the old
         `unimarket.app` placeholder when the product name was finalized to Zunio), which is
         NOT a verified Resend domain yet, so production sends will 403 until the real domain
         is picked and verified at resend.com/domains (blocks 0.10 deploy step — do this
         before going live). Email send failures are caught so signup still succeeds either way.

[x] 0.6  school-combobox component
         Searches schools_directory table via Supabase query (client-side filtered)
         Shows name + campus + state in dropdown
         "My school isn't listed" option → reveals free text input
         Used on teaser page AND main app sign-up form (same component)
         Files: components/school-combobox.tsx, lib/schools.ts (search query helper)
         Debounced (250ms) live search against real schools_directory table, tested in
         browser preview — typing "Northeastern" returns real matches within ~1s.

[x] 0.7  Teaser page UI (components/teaser-page.tsx)
         Logo / wordmark
         One-line value prop
         Email input field
         School combobox (from 0.6)
         Submit button
         Confirmation state (inline, no page reload)
         Mobile-responsive
         Design source: /Users/anhbui/zunio-design-materials/ (zunio_landing_page_v5.html for
         palette/type/component style, llc_logos/ for logo assets, ère waitlist page as layout
         reference — split image-left/content-right arrangement). Design tokens centralized in
         lib/design-tokens.ts → tailwind.config.ts (brand.* color/radius/shadow scale, no
         inline styles). Fonts: Inter (body) + Plus Jakarta Sans (display/logo, matches the
         logo SVG's embedded font) via next/font/google.
         Files: components/teaser-page.tsx, components/waitlist-form.tsx,
         components/school-combobox.tsx, components/logo.tsx, lib/schools.ts
         Tested end-to-end in browser preview at desktop (1440px) and mobile (390px) widths:
         both the school_id path (selecting Northeastern from live search) and the
         school_name_raw fallback path ("My school isn't listed") submit correctly, land in
         the real waitlist table, and show the inline confirmation state. Test rows deleted
         after. Fixed a bug during testing: selecting a school re-triggered a wasted search
         using the selected label as the query — added a skip-next-search ref guard.

[x] 0.8  Wire NEXT_PUBLIC_LAUNCHED flag into app/page.tsx
         NEXT_PUBLIC_LAUNCHED=false → render <TeaserPage />
         NEXT_PUBLIC_LAUNCHED=true  → render <BrowsePage /> (stub for now)
         components/browse-page-stub.tsx added as the placeholder until Phase 1 item 1.6
         builds the real BrowsePage.

[x] 0.9  Resend confirmation email template
         Subject: "You're on the list"
         Body: brief, warm, tells them we'll email when their school launches
         From: hello@[domain]
         Files: lib/resend.ts — plain-text placeholder copy, no branding/logo yet.
         Will restyle once design/logo package is provided (see visual polish note below).

[ ] 0.9b Migrate tool ownership to zunio account
         GitHub repo, Supabase project, and Resend account are all currently under
         the technical co-founder's personal email/GitHub — not a zunio-owned account.
         Before (or during) 0.10 deploy, transfer/add zunio as owner on:
           - GitHub repo (Settings → Transfer ownership, or add zunio org/account
             as owner and update remote)
           - Supabase project (Project Settings → transfer project, or invite zunio
             account as owner)
           - Resend account (invite zunio account, transfer domain/API key ownership)
         Do this before connecting Vercel to the GitHub repo (0.10) if possible —
         migrating after Vercel is linked adds an extra step of re-linking the repo.
         See DECISIONS.md entry for full context.

[ ] 0.10 Deploy to Vercel + verify end-to-end
         Connect repo to Vercel project
         Add domain in Vercel, set DNS records at registrar
         Set env vars in Vercel dashboard
         Test full flow: submit form → check Supabase waitlist table → check email inbox
         Confirm mobile layout on real phone

[ ] 0.11 Write launch email draft in Resend (save as draft, do not send)
         Subject: "[App name] is live at [school] — you're in"
         CTA: link to app
         Personalized by school name (query waitlist grouped by school_id at send time)
```

---

## Phase 1 — Foundation (July, weeks 1–4)

**Goal:** Core app skeleton. Auth works. School-scoped browse feed exists (may be empty). Listing creation works.
**Deploy target:** Vercel preview URL shared with business co-founder for feedback.
**Success criteria:** Can sign up, verify email, post a listing, see it in the browse feed.

```
[x] 1.1  Next.js project scaffold (pulled forward into Phase 0 — teaser items 0.5–0.8 need it)
         npx create-next-app@14 --typescript --tailwind --app
         Install: @supabase/supabase-js @supabase/ssr resend zod bad-words
         Set up lib/supabase/client.ts and lib/supabase/server.ts

[x] 1.2  Supabase Auth — sign up
         Form: email, display name, school (school-combobox from 0.6), optional photo
         API route: validate inputs (Zod + bad-words for display_name)
         Create auth.users record (Supabase handles)
         Create users record with generated slug, contact_email = auth_email, school_id
         Redirect to browse with unverified banner
         Files: app/api/auth/sign-up/route.ts, app/(auth)/sign-up/page.tsx,
         components/forms/SignUpForm.tsx, components/ui/ActiveSchoolSelect.tsx,
         utils/slug.ts
         Photo upload deferred — no Storage bucket exists yet, will build once for both
         sign-up and listing photos together when Storage is set up (fits 1.8's scope).
         IMPORTANT correction from 0.6's spec: does NOT reuse SchoolCombobox as-is. That
         component searches schools_directory (~2,510 IPEDS schools); users.school_id FKs
         to schools (active/launched only, currently 1 row). Built a separate
         ActiveSchoolSelect component querying the correct table — see DECISIONS.md.
         Verified end-to-end: Zod validation (400s), profanity filter, Supabase Auth
         signUp wiring all confirmed via real GoTrue responses. Full DB insert path
         (slug generation + FK-correct users insert) verified via a one-off Admin-API
         test user (bypasses Supabase's built-in mailer, which has a strict rate limit
         that blocked live end-to-end testing after ~2 attempts — expected free-tier
         behavior, not a bug). Test data cleaned up after.

[x] 1.3  Supabase Auth — sign in + session handling
         Sign in page
         Session cookies via @supabase/ssr (server client reads cookies on every request)
         Protected route middleware (redirect to sign-in if no session)
         Files: app/(auth)/sign-in/page.tsx, components/forms/SignInForm.tsx, middleware.ts
         Sign-in done client-side via lib/supabase/client.ts's signInWithPassword (no API
         route needed — no extra server-side logic beyond what Supabase Auth itself does,
         unlike sign-up which needs the users-table insert).
         Middleware matcher scoped to /account/:path*, /listings/new, /listings/:id/edit
         only — browsing stays open, per CLAUDE.md's "no login wall" decision. Add new
         protected paths here as those pages get built.
         Verified end-to-end: unauthenticated request to /account redirects to /sign-in;
         root / unaffected (no login wall); real sign-in (via Admin-API-created test user,
         bypassing the mailer) sets the sb-*-auth-token cookie and redirects to /; same
         protected path then passes through with no redirect (404 instead, expected —
         /account/page.tsx doesn't exist yet, that's item 2.6). Test user cleaned up after.

[x] 1.4  Email verification state
         Unverified: show persistent banner "Verify your email to post listings"
         Clicking Post while unverified → "Check your email" page with resend button
         Verified: banner disappears, full access
         MAJOR IMPLEMENTATION CHANGE — not Supabase's built-in email confirmation.
         Supabase's "Confirm email" setting is all-or-nothing: with it on, NO session is
         issued (not on sign-up, not on sign-in) until the user clicks Supabase's own
         confirmation link — the "browse freely while unverified" UX this item specifies
         is unreachable under that setting. Disabled it project-wide (supabase/config.toml
         [auth.email] enable_confirmations = false, applied via `supabase config push`),
         so sign-up now always issues a session immediately. Built our OWN verification
         system instead: users.email_verified_at (public-readable column) + a separate
         email_verifications table (token, service-role only — never exposed via the
         public "read user profiles" RLS policy, unlike a token column on users would be).
         Verification email sent via Resend (lib/resend.ts sendEmailVerification), not
         Supabase's mailer — consistent with every other email in the app, and avoids
         Supabase's very strict free-tier mailer rate limit (2/hour) hit repeatedly
         during this project. See DECISIONS.md for full reasoning.
         Files: supabase/migrations/005_email_verification.sql, utils/token.ts,
         lib/resend.ts (sendEmailVerification), app/api/auth/verify-email/route.ts,
         app/api/auth/resend-verification/route.ts, components/ui/EmailVerificationBanner.tsx,
         app/(auth)/check-email/page.tsx, middleware.ts (checks users.email_verified_at,
         not session.user.email_confirmed_at)
         BUG CAUGHT DURING TESTING: banner was originally a client component using the
         browser Supabase client's onAuthStateChange — this never fires when a SEPARATE
         server-side client (our sign-up API route) sets the session cookie, since browser
         and server client instances don't sync automatically. Banner silently never
         appeared after sign-up. Fixed by converting it to an async Server Component that
         reads cookies directly — correctly re-renders on every router.refresh().
         Verified end-to-end live: sign-up → banner shows → /listings/new redirects to
         /check-email → visiting the real verify-email link (token pulled from DB, same
         as clicking the emailed link) → banner disappears → /listings/new no longer
         redirects (404 instead, expected — page doesn't exist until 1.8) → /account still
         accessible with just a session, no verification required. Test data cleaned up.

[ ] 1.5  school-switcher component (browse page)
         Prominent at top of browse page (not nav)
         Searches schools table (active only — not schools_directory)
         Default: Northeastern for logged-out users (localStorage)
         Logged-in users: default to their profile school_id
         Switching school: updates React state / URL param only, not users.school_id

[ ] 1.6  Browse page (app/page.tsx — BrowsePage component)
         School-scoped listing grid
         Filters: category, price range, free items toggle, condition
         Sort: newest, price low→high, price high→low
         Search bar (full-text, school-scoped)
         Cursor-based pagination ("Load more")
         Zero-results state: "No listings for '[query]' at [school]. Browse all ↗"
         Empty school state: "Be the first to sell here" CTA
         SSR — page renders on server with initial data

[ ] 1.7  listing-card component
         Thumbnail (images[1]), title, price (or "Free"), category, condition
         Posted date, seller name, school name
         Links to listing detail page

[ ] 1.8  Create listing (app/listings/new/page.tsx)
         Form: title, description, price / free toggle, category, condition,
               photos (up to 5), pickup hint, AUP checkbox
         Image upload: client-side compress → Supabase Storage signed URL → upload
         POST /api/listings route
         Cap check: reject if user already has 10 active listings
         listing_type defaults to 'supply', quantity NULL (v2 fields, not in UI)

[ ] 1.9  Listing detail page (app/listings/[id]/page.tsx)
         SSR
         Title, description, price, condition, category, photos, pickup hint
         Posted date, "Edited" badge if updated_at > created_at + 1hr
         Seller card (name, school, member since, photo → links to profile)
         "Message seller" button (requires login)
         "Mark as sold" button (owner only)
         "Report this listing" link

[x] 1.10 Database migrations for main schema
         supabase/migrations/004_main_schema.sql
         (users, listings, contact_requests, blocked_users,
          listing_matches, negotiation_preferences,
          conversations, conversation_participants, messages,
          triggers, RLS policies)
         Pulled forward to unblock 1.2 (users table needed for sign-up). Full canonical
         schema applied as one migration since later tables (listings, contact_requests)
         FK to users anyway. Verified via REST: users table queryable, FK constraints work.
```

---

## Phase 2 — MVP Complete (August, weeks 1–4)

**Goal:** Every MVP feature working. Ready for real users.
**Deploy target:** Production domain (NEXT_PUBLIC_LAUNCHED flipped to true at end of this phase).
**Success criteria:** Complete buyer → seller flow works. Listing expiry works. Report flow works.

```
[ ] 2.1  Contact seller flow (POST /api/contact)
         Rate limit checks (3 per listing, 10 per hour)
         Blocked users check
         INSERT contact_requests
         Resend email to seller's contact_email, Reply-To = buyer email
         Show buyer: "Your message was sent. The seller will reply to your email directly."

[ ] 2.2  contact-form component
         Message textarea (10–1000 chars with counter)
         Submit button
         Sends POST /api/contact
         Shows confirmation state

[ ] 2.3  Edit listing (app/listings/[id]/edit/page.tsx)
         Same form as create, pre-filled
         PATCH /api/listings/[id]
         Does NOT update created_at
         Triggers updated_at via DB trigger

[ ] 2.4  Mark as sold
         PATCH /api/listings/[id] with status='sold'
         Owner-only (RLS + API route ownership check)

[ ] 2.5  Seller profile page (app/u/[slug]/page.tsx)
         SSR for SEO
         Name, school, member since, bio, social link (validated), active listings grid
         One query (see reference query in CLAUDE.md)

[ ] 2.6  Account settings page (app/account/page.tsx)
         Edit: display name, contact_email, school, bio, social_url, profile photo
         View active listings (edit / mark sold / delete)
         View sold listings
         Sign out
         Social URL validation: must start with approved prefix list

[ ] 2.7  Listing expiry cron
         vercel.json: schedule GET /api/cron/expire daily at 05:00 UTC
         Route: protected by CRON_SECRET header
         UPDATE listings SET status='expired' WHERE status='active' AND expires_at < now()
         Resend expiry email to each seller with renewal link

[ ] 2.8  Listing renewal
         PATCH /api/listings/[id] with status='active', expires_at = now() + 30 days
         Auth required, ownership checked

[ ] 2.9  Report listing
         "Report this listing" link on all listing detail pages
         POST /api/report → sends email to moderation@[domain] with listing ID, URL, reporter ID
         No confirmation needed beyond "Thanks for the report"

[ ] 2.10 Image cleanup webhook
         Supabase Database Webhook on listings table UPDATE
         Triggers Supabase Edge Function to delete Storage objects when deleted_at set or status='removed'

[ ] 2.11 Polish pass
         Mobile layout audit on real device
         Error states for all forms (network errors, validation errors)
         Empty states for all lists
         Loading states
         Accessibility: keyboard navigation, focus rings, alt text on images

[ ] 2.12 Seed listings for launch
         Both co-founders post 20–30 real items
         Recruit 10 friends to post items
         Verify feed looks alive before flipping NEXT_PUBLIC_LAUNCHED

[ ] 2.13 Pre-launch checklist
         [ ] AUP page written and linked from listing form checkbox
         [ ] Resend upgraded to paid tier
         [ ] All env vars set in Vercel production
         [ ] Custom domain resolving correctly
         [ ] supabase gen types typescript run, database.ts committed
         [ ] Test full buyer flow on mobile: browse → view listing → sign up → message seller
         [ ] Test full seller flow on mobile: sign up → post listing → receive message email
         [ ] Confirm GitHub repo, Supabase project, Resend account, and Vercel project are
             all owned by the zunio account, not a personal account (see 0.9b)

[ ] 2.14 Flip to launched
         Set NEXT_PUBLIC_LAUNCHED=true in Vercel env vars
         Redeploy
         Send launch email blast to waitlist (school-specific subject lines)
```

---

## Phase 3 — v2: Demand Posts + Matching (post-launch)

**Prerequisite:** Supply-side validation. At least 2 schools with consistent weekly new listings and completed transactions.
**Do not start this phase until prerequisite is met.**

```
[ ] 3.1  Demand post UI (listing_type='demand' — DB column already exists)
         "Wanted" tab on browse page
         Create demand listing form (title = "Looking for: X", price = budget ceiling, quantity)
         Demand listings visible in separate feed, not mixed with supply

[ ] 3.2  Matching engine — supply triggers demand query
         On supply post creation: query active demand posts at same school + category + compatible price
         Write matches to listing_matches table
         Send email notifications to matching buyers

[ ] 3.3  Matching engine — demand triggers supply query
         On demand post creation: query active supply posts at same school + category + compatible price
         Write matches to listing_matches table
         Send email notifications to matching sellers

[ ] 3.4  User blocking UI
         Block button on profile and listing detail pages
         blocked_users table already in DB
         Contact and browse queries already check this table

[ ] 3.5  In-app chat
         Activate Supabase Realtime subscription on messages table
         Build chat UI: conversation list, message thread, send form
         Schema already in DB (conversations, conversation_participants, messages)
         Email fallback notification for offline users

[ ] 3.6  Seller ratings and reviews

[ ] 3.7  Saved / wishlist items
```

---

## Phase 4 — v3: AI Dealer (post v2 validation)

**Prerequisite:** Demand posts are being used. Matches are happening. Evidence that negotiations stall.
**Do not start this phase until prerequisite is met.**

```
[ ] 4.1  Negotiation preferences UI
         Private price range input on demand and supply listing forms
         Stored in negotiation_preferences table (service role only)
         Never shown to the other party

[ ] 4.2  AI dealer — gap detection
         When a match is found, compare private ranges
         If ranges overlap → deal is possible
         If gap exists → calculate gap size, decide if worth proposing

[ ] 4.3  AI dealer — proposal generation
         Claude API integration (claude-sonnet model)
         Generate natural language proposal to both parties
         Email both with proposed deal terms

[ ] 4.4  Confirmation flow
         Both parties must explicitly confirm
         AI cannot commit on anyone's behalf (non-negotiable)
         On both confirmations: exchange contact details, mark listings matched

[ ] 4.5  Payments (Stripe Connect)
         Only after AI dealer proves deal-making works
```

---

## How to start a session

1. Tell Claude Code: "Read CLAUDE.md, DECISIONS.md, and BUILDORDER.md (in the `info/` folder). Summarize what phase we're on and what the next unchecked item is."
2. Verify the summary is correct before writing any code.
3. Work through one item at a time. Mark `[x]` when complete.
4. If a new decision is made during the session, append it to DECISIONS.md before ending the session.
