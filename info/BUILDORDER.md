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
         [2026-08-XX UPDATE] Real domain zunio.org purchased and verified in Resend.
         EMAIL_FROM=team@zunio.org set in .env.local (still needs to be added in Vercel's
         production env vars before deploy — see 0.10). Confirmed live: a direct send from
         team@zunio.org via the Resend API succeeded (200, real message id), no longer
         blocked. lib/resend.ts's fallback default updated to team@zunio.org to match.
         Email send failures are still caught so signup succeeds either way regardless.

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
         [2026-08-19 DECISION] Deliberately deferred — technical co-founder wants to
         retain sole authority over GitHub/Supabase/Resend for now, rather than
         migrate before launch as originally planned. Vercel deploy (0.10) proceeded
         on personal-account ownership. Revisit before any point where shared control
         actually matters (e.g. adding a second engineer, or a legal/equity reason
         to formalize company ownership of infra).

[x] 0.10 Deploy to Vercel + verify end-to-end
         [2026-08-19] Deployed — teaser page live on the production domain.

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
         [2026-08-03 UPDATE] Reverted the ActiveSchoolSelect-only restriction — sign-up now
         searches the full schools_directory again (like SchoolCombobox, but with the
         "isn't listed" free-text option disabled via a new `allowUnlisted` prop, since
         accounts must always FK to a real school). Signing up at a school with no `schools`
         row yet auto-creates one (active: false) via lib/schools.ts's getOrCreateSchool().
         School-launch status now only matters for browsing, never for who can sign up.
         See DECISIONS.md "Sign-up allows any school..." for the reasoning.
         ActiveSchoolSelect.tsx is unused now but kept — still the right component for the
         future browse-page school switcher (1.5), where active-only makes sense.

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

         [2026-08-03 CORRECTION] Initial version gated posting on email_verified_at (any
         verified email) — a real trust/safety gap, since is_seller_verified (verified
         SCHOOL email specifically) already existed in the schema for exactly this purpose
         but nothing set it. Fixed: verify-email route now checks whether the verified
         email's domain matches the user's school's domain (schools_directory.domain) and
         only then sets is_seller_verified; middleware and the banner both switched to
         checking is_seller_verified instead. email_verifications gained an `email` column
         so a token can target either the original signup email or a later-added one.
         Added a minimal /account/add-school-email flow (page + route + form) so accounts
         that signed up with a personal email have an actual way to unlock posting later —
         this doesn't fully replace the future full account settings page (2.6), just the
         one piece needed to make the sign-up copy's "add a school email later" promise true.
         Verified end-to-end live with a real non-launched school (Amherst College, no prior
         schools row): sign-up with a personal Gmail → schools row auto-created (active:
         false) → banner shows "verify your email" → verified → banner switches to "add a
         school email" (is_seller_verified still false, correct) → added a matching
         @amherst.edu address via the new flow → is_seller_verified flips true, original
         email_verified_at timestamp preserved (not overwritten) → banner gone →
         /listings/new no longer redirects. Test data cleaned up after.

[x] 1.5  school-switcher component (browse page)
         Files: components/browse/SchoolSwitcher.tsx
         Dropdown at top of the browse page (not nav), lists active schools only via
         lib/schools.ts getActiveSchools(). Selection persists to localStorage
         (zunio.browse.schoolId / .schoolLabel) for logged-out visitors; signed-in
         users always start at their profile school_id (localStorage is ignored for
         them, so a stale logged-out choice can't override their real school).
         Switching only changes React state — never writes users.school_id.

[x] 1.6  Browse page (app/page.tsx — BrowsePage component)
         Files: components/browse/BrowsePage.tsx, SearchBar.tsx, SortSelect.tsx,
         FilterPanel.tsx, ListingGrid.tsx, lib/listings.ts,
         supabase/migrations/010_search_listings.sql
         SSR: app/page.tsx resolves the default school server-side (profile school if
         signed in, else northeastern-boston) and fetches page 1 before render;
         the client component takes over for switching/filtering/searching.
         NEW MIGRATION 010: search_listings() RPC. PostgREST can filter by
         plainto_tsquery but cannot ORDER BY a computed ts_rank(), so relevance
         sorting needs a function. SECURITY INVOKER, so the existing "public read
         active supply listings" RLS policy still applies — it can't expose anything
         a direct SELECT couldn't. Applied to remote, verified via `migration list`.
         Cursor pagination ("Load more") applies to the newest sort only; price
         sorts and search return a single page at MVP scope.
         MIGRATION 011: free items (price IS NULL) now appear in the "Under $X"
         buckets — `NULL <= n` is NULL in SQL, so both the browse query and the RPC
         were silently hiding free listings from every price filter. See CHANGELOG
         2026-08-19. The separate free-items toggle still narrows to only free.
         Verified live against real Supabase with 6 temporary listings at
         Northeastern (test user + rows deleted afterward, real account untouched):
         SSR first paint, relevance search ("desk" → only the 2 desk items),
         zero-results copy, free-items filter (null price), Under $50 bucket,
         price high→low ordering, clearing search restores the full grid, no console
         errors, and mobile (375px) renders a clean 2-col grid with no overflow.

[x] 1.7  listing-card component
         Files: components/browse/ListingCard.tsx
         Thumbnail (images[1] via next/image), title, price or "Free", category,
         condition, posted date, seller name; links to /listings/[id].
         "Edited" badge when updated_at > created_at + 1hr — verified it appears
         only on a genuinely edited row, not on freshly inserted ones.
         Note: school name is NOT on the card. The whole grid is scoped to one
         school shown in the switcher directly above, so per-card repetition would
         be noise. Confirmed with the founder 2026-08-19: acceptable precisely
         BECAUSE results are guaranteed school-scoped — so that guarantee was then
         proven explicitly rather than assumed. Verified live with listings seeded
         at TWO active schools simultaneously (Northeastern + a temporary Boston
         University row, both removed after): the default SSR feed, the school
         switcher, the price/category filters, AND the search RPC each returned
         only the selected school's listings. The strongest case: searching "free"
         while on BU returned only BU's free listing, correctly excluding NEU's
         "Free Moving Boxes", which matches the query text but belongs to another
         school. Revisit the card if a cross-school/merged feed ships (v2), since
         that guarantee no longer holds there.

[x] 1.8  Create listing (app/listings/new/page.tsx)
         Files: app/listings/new/page.tsx, components/forms/ListingForm.tsx,
         app/api/listings/route.ts, app/api/listings/upload-url/route.ts,
         lib/auth-guard.ts, lib/images.ts, lib/validations.ts (listingSchema),
         next.config.mjs (image remotePatterns),
         supabase/migrations/012_listing_images_storage.sql

         SECURITY MODEL (decided with the founder before building):
         - middleware.ts does NOT match /api/*, so the page redirect is a UX
           affordance, not a boundary. Both API routes call requireVerifiedSeller()
           themselves: session + profile exists + not deleted + not suspended +
           is_seller_verified. Shared helper so the two can't drift apart.
         - user_id/school_id come from the session, never the request body.
         - Uploads use SERVER-ISSUED signed URLs (chosen over direct client upload):
           /api/listings/upload-url runs the same guard BEFORE issuing a URL, so an
           unverified account cannot move a single byte into Storage. Filenames are
           server-generated (uuid + extension from the validated content type), so a
           client-supplied name can never shape the stored path.
         - images[] is client-supplied text, so the route re-verifies every path is
           under the caller's own {user_id}/ prefix AND actually exists in the bucket.
           Without this, a "photo" could point at any URL — rendering third-party
           content in the feed and leaking viewers' IPs to whoever hosts it.
         - Bucket rejects image/svg+xml (SVG can carry <script>; served from the
           Storage origin that would be stored XSS). 5 MB cap, raster types only.
           Storage RLS restricts writes to the owner's own prefix as defense in depth.
         - next.config.mjs allows ONLY the project's own Storage host for next/image,
           so the ownership check can't be undone at the render layer.
         - Client-side canvas compression strips EXIF: phone photos carry GPS, and a
           student shooting a desk in their dorm would otherwise publish where they
           sleep. Compression is the privacy fix, not just bandwidth — do not replace
           it with a direct File upload.
         - AUP checkbox enforced server-side (z.literal(true)) — it's the legal shield,
           so a client that omits it must not be able to post.
         - Profanity filter on TITLE only (founder's call): titles are public and
           indexed; filtering descriptions would reject legitimate long text.
         - Price: rejects 0 (schema wants NULL for free), negatives, >2 decimals, and
           values that would overflow numeric(10,2) as a raw 500.
         - KNOWN LIMITATION: the 10-listing cap is check-then-insert, so concurrent
           requests could allow a couple extra. Accepted at MVP over row locking.

         Verified live against real Supabase (all test users, listings, and Storage
         objects deleted afterward): unauthenticated POST to both routes → 401;
         signed-in but unverified → 403 on both; 9 validation cases (price 0/negative/
         overflow/3-decimals, AUP false, AUP missing, bad category, short title, long
         description) → 400; images pointing at another user's prefix, an external
         URL, a path-traversal string, or an own-prefix path never uploaded → 400;
         >5 images → 400; profane title → 400; user_id spoofed in the body → ignored,
         listing stored under the session user; 11th active listing → 409.
         Happy path through the real form with a GPS-tagged 2400x1600 JPEG: stored as
         1600x1067 with ZERO EXIF keys and no GPS IFD (60.8 KB → 10.8 KB), path saved
         under the seller's prefix, and the photo renders in the browse grid.
         Two bugs found and fixed during this — see CHANGELOG 2026-08-19.

[x] 1.9  Listing detail page (app/listings/[id]/page.tsx)
         Files: app/listings/[id]/page.tsx, components/listings/ListingGallery.tsx,
         lib/listing-format.ts, config/site.ts (moderationEmail),
         supabase/migrations/013_owners_read_own_listings.sql

         SSR server component; generateMetadata sets title/description/OG image so
         listings are crawlable (CLAUDE.md wants Google indexing).
         Shared display helpers extracted to lib/listing-format.ts and reused by
         ListingCard, so the grid and detail page can't format price/labels/the
         "Edited" rule two different ways.

         NEW MIGRATION 013 — owners read own listings. The existing policy is
         `status='active' AND deleted_at IS NULL AND listing_type='supply'`, which
         applies to the OWNER too: a seller could not read their own listing once
         it left active. The moment mark-as-sold (2.4) ships, a seller would mark an
         item sold and immediately 404 on their own page, and the account page (2.6)
         could not list sold items — both would look like data loss. Added
         `USING (auth.uid() = user_id AND deleted_at IS NULL)`. deleted_at stays
         excluded: soft deletes are moderation removals, invisible to the owner too.

         Security notes:
         - contact_email is never selected here; migration 009 revoked it so a
           seller's address cannot leak through a public page. Verified: the
           rendered HTML contains no email, contact_email, or seller flags.
         - UUID-shaped guard before querying, so /listings/garbage returns a clean
           404 instead of surfacing a Postgres 22P02 invalid-uuid error.
         - Description renders as plain text with whitespace-pre-line. Deliberately
           NOT auto-linked — turning seller-authored text into clickable links makes
           the description a one-click phishing vector.
         - Listings belonging to suspended/soft-deleted sellers vanish through the
           !inner join, since the users RLS policy hides those rows.

         Verified live: renders title/price/category/condition/posted date/pickup
         hint/description with line breaks preserved; "Edited" badge appears only on
         a genuinely edited row; NULL price renders "Free"; multi-photo gallery
         switches the main image on thumbnail click. Access control across all three
         viewer states — logged out sees "Sign in to message seller", signed-in
         non-owner sees "Message seller", owner sees Edit + Mark as sold and no
         message button. A sold listing 404s for the public AND for a signed-in
         non-owner, but renders for the owner with an explanatory banner (013
         working). Malformed UUID → 404, non-existent UUID → 404. Mobile (375px)
         stacks with no horizontal overflow. All test users, listings, and Storage
         objects removed afterward.

         STUBBED, not built — these are 2.x items, and the buttons are wired to
         match their real end state rather than pretending to work:
         - "Mark as sold" renders disabled for the owner (2.4 builds the PATCH).
         - "Message seller" links to /listings/[id]/contact, which does not exist
           yet (2.1/2.2 build the contact flow + route).
         - Seller card links to /u/[slug], which 404s until 2.5.
         - "Report this listing" is a mailto: to config.site moderationEmail —
           moderation is manual at MVP per CLAUDE.md. moderation@zunio.org MUST be
           a real monitored inbox before launch (add to the 2.13 checklist).

         KNOWN ISSUE for later: the seller card renders profile_photo through
         next/image, but next.config.mjs only allows the /listing-images/** path on
         the Supabase host. profile_photo is NULL everywhere today (photo upload was
         deferred in 1.2), so nothing breaks — but whichever item ships profile
         photos must add that bucket path to remotePatterns, or the whole page will
         throw at render instead of just missing an avatar.

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
[x] 2.1  SUPERSEDED BY REALTIME CHAT — see DECISIONS.md 2026-08-19.
[x] 2.2  The email-relay contact flow was replaced with live in-app chat
         (item 3.5 pulled forward at the founder's request). contact_requests
         stays in the schema, unused.
         Files: supabase/migrations/019_chat_rls_and_realtime.sql,
         020_chat_notifications.sql, lib/chat.ts, app/api/conversations/route.ts,
         app/api/messages/route.ts, components/chat/MessageThread.tsx,
         components/listings/MessageSellerButton.tsx, app/messages/page.tsx,
         app/messages/[id]/page.tsx, lib/resend.ts (escapeHtml +
         sendMessageNotification)
         TRAP: supabase.realtime.setAuth(token) is required before subscribing,
         or the socket runs as anon, RLS filters everything, and the channel
         reports SUBSCRIBED while delivering nothing. See DECISIONS.md.

--- ORIGINAL 2.1/2.2 SPEC, KEPT FOR REFERENCE ---
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

[ ] 2.12 Seed listings for launch — BOTH schools (see DECISIONS.md 2026-08-19)
         Launching at Northeastern AND DePauw means TWO feeds must look alive,
         not one. 20–30 real items *per school*, not 20–30 total — a visitor
         only ever sees their own school's grid, so a well-stocked Northeastern
         feed does nothing for a DePauw student staring at "Be the first to
         sell here."
         Northeastern: Tanya is on campus — recruit directly.
         DePauw: no co-founder on campus (Anh is an alum in NYC), so this needs
         a named plan — specific friends still enrolled, a club, or a group
         chat — rather than assuming momentum. Treat it as the harder of the two.
         Reality check as of 2026-08-19: 6 waitlist signups total across 5
         schools (NEU 2, DePauw 1). The launch blast reaches ~6 people, so
         day-one inventory comes from seeding, not from the waitlist.
         Verify BOTH feeds look alive before flipping NEXT_PUBLIC_LAUNCHED.

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
         [ ] Abuse protection on the two fully-public POST routes (/api/waitlist,
             /api/auth/sign-up) — see "Abuse protection deferred" note below
         [ ] moderation@zunio.org exists and is monitored — the "Report this
             listing" link (1.9) mails it, and moderation is manual at MVP, so an
             unmonitored inbox means reports silently go nowhere
         [ ] Stamp schools.launched_at for both launch schools at the flip —
             seed.ts no longer sets it (see CHANGELOG 2026-08-19), so both rows
             are NULL until launch day and must be set deliberately

--- ABUSE PROTECTION DEFERRED (decided 2026-08-07) ---
Cloudflare Turnstile + per-IP rate limiting were scoped in detail but deliberately
NOT built yet. Gated on 2.13 above — must land before flipping live.

Why deferred: the original concern (one person spamming the submit button) turned
out to be already covered three ways — both forms disable the button while
submitting; waitlist.email has a unique constraint and duplicates return success
BEFORE reaching the send; sign-up gets a 409 from Supabase on an existing email
with no second send. So repeat-submit costs nothing. The only real remaining gap
is a bot submitting many UNIQUE fake emails (junk rows + burned Resend quota).
At 3 signups with no public awareness that's low-probability, bounded, recoverable,
and — since the 2026-08-05 email-tracking work — actually visible via
confirmation_sent_at/sent_at staying NULL plus real error logs. Browse page
(1.5/1.6) is the higher-value work; revisit this before real traffic.

Preferred approach when built:
- Cloudflare Turnstile over Google reCAPTCHA. Turnstile is usually invisible (no
  conversion friction on a form whose whole job is conversion), doesn't feed
  student behavior to Google ad-tech, and avoids the privacy-policy obligation
  reCAPTCHA drags along.
- Turnstile is arguably the better SINGLE choice here vs. IP rate limiting: an
  entire dorm shares one campus-wifi public IP, so per-IP limits risk blocking
  real students en masse on launch day. Turnstile is IP-agnostic.
- If also doing rate limiting: `rate_limits (id, key, created_at)` table, RLS on
  with NO policies (service-role only, same pattern as email_verifications /
  negotiation_preferences). Key on "<route>:<ip>" from x-forwarded-for. Limit
  generous enough for dorm traffic (~20/hr, NOT 5). Note: no local
  x-forwarded-for, so dev requests share one bucket.
- Turnstile needs a Cloudflare account — create it under the ZUNIO account from
  day one, not personal (see 0.9b account-ownership debt).
- Turnstile does NOT require moving DNS to Cloudflare. Do not migrate zunio.org's
  DNS before launch — Resend domain verification depends on the DKIM/SPF records
  currently at the registrar, and recreating them wrong silently breaks email.

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

[ ] 3.7  Saved / wishlist items ("favorites")
         DEFERRED FROM THE LANDING-PAGE REDESIGN (2026-08-19): the approved
         design includes a heart/favorite button on every listing card. It was
         deliberately LEFT OUT of the build rather than shipped as a dead
         control — a heart that does nothing when tapped reads as broken.
         When built: saved_items table (user_id, listing_id, created_at,
         PK on both), RLS scoped to auth.uid(), a toggle route, and a saved
         page. Add the button back to ListingCard at that point — the design
         already has a slot for it in the card's top-right.
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
