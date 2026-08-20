# Zunio — Decision Log

Every architectural, product, and schema decision lives here with reasoning and what was rejected. Claude Code reads this to avoid re-opening closed decisions. When a new decision is made, append it at the bottom with the date.

Format:
**[DATE] Decision title**
DECIDED: what was chosen
REASON: why
REJECTED: what was considered and why it lost

---

**[2026-06] Web-first, no native mobile app**
DECIDED: Next.js web app (PWA-capable) for launch
REASON: One codebase, no app store review delays (2–7 days, unpredictable), push notifications are out of MVP scope anyway, web gives free SEO for listing pages and seller profiles. Facebook Marketplace, Depop, and Craigslist all launched or dominated as web-first.
REJECTED: React Native (two codebases, app store friction), Flutter (new language, same problems)

---

**[2026-06] Supabase over MongoDB**
DECIDED: Supabase (Postgres) for all backend data
REASON: Marketplace data is deeply relational — users → listings → categories → contact_requests → schools. Postgres JOINs are simpler to read and maintain than MongoDB aggregation pipelines for this domain. Supabase bundles Auth, Storage, and Realtime so we don't need Auth0, S3, or a separate WebSocket server. Full-text search (tsvector) is built into Postgres at no cost. Atlas Search (MongoDB's full-text) requires a paid $57/mo cluster. Supabase is vanilla Postgres under the hood — migration to Amazon RDS is a connection string change only.
REJECTED: MongoDB Atlas (relational data in a document store, no built-in auth/storage, paid search tier), Firebase (high vendor lock-in, Firestore query model breaks for relational data, post-mortems from multiple YC companies about painful migrations)

---

**[2026-06] School-based feed scoping, not GPS, not ZIP**
DECIDED: `school_id` foreign key on users, feed filtered by `WHERE u.school_id = $1`
REASON: ~30% of web users deny location permission — broken default state on day one. Sellers post from home, dorms, or their hometown — GPS coordinates don't represent "my campus community." A student posting from home for summer still wants their listing visible at Northeastern. PostGIS extension + spatial index + radius math + permission UI = 2–3 extra days of work with zero user benefit. ZIP boundaries don't align with campuses and users don't think in ZIP codes.
REJECTED: GPS/PostGIS radius (permission denial rate, sellers post from home, 2-3 day complexity), ZIP code scoping (doesn't map to campuses, loses student community identity)

---

**[2026-06] Email relay for contact, not in-app chat**
DECIDED: Resend email relay for MVP messaging. Buyer sends message → Resend delivers to seller's contact_email with reply-to set to buyer's email. Conversation continues in email inboxes.
REASON: Email relay is ~1 day to build. In-app chat is 3–4 weeks. Chat requires: WebSocket lifecycle (Supabase Realtime handles infra but not the product layer), conversation/message/participants schema, full chat UI (bubbles, scroll lock, unread counts, timestamps, pagination), email fallback notifications for offline users, abuse/moderation within the chat system, user blocking enforcement in messages. Chat schema already exists in DB — activating it in v2 requires building the UI only, no migration.
REJECTED: Supabase Realtime chat for MVP (3-4 weeks, no validated demand yet)

---

**[2026-06] Supabase for waitlist storage, Resend for email delivery only**
DECIDED: Waitlist signups stored in Postgres `waitlist` table. Resend used only to send the confirmation email and eventually the launch blast. Resend Audiences not used.
REASON: Waitlist is the most valuable pre-launch asset — list of people who want the product, segmented by school. It belongs in our own database, not in a third-party email tool's system. Storing it in Supabase means full SQL power: group by school, count signups by week, JOIN to schools_directory for school names. Resend Audiences would require exporting data back out at launch time and can't be queried with SQL.
REJECTED: Resend Audiences (data lives in wrong place, no SQL query power, adds a third-party dependency for data we own)

---

**[2026-06] Split schools_directory + schools tables**
DECIDED: Two tables. `schools_directory` holds full IPEDS dataset (~2,800 4-year US institutions) for autocomplete. `schools` holds only active/launched campuses (small, curated) for feed scoping. Users and listings FK to `schools.id`. Waitlist FKs to `schools_directory.id`.
REASON: Importing all 2,800 IPEDS schools into a single `schools` table would let users at University of Alaska Fairbanks sign up and get an empty feed forever — a broken first experience. The split ensures feed scoping stays intentional while autocomplete still covers every school (like LinkedIn's picker). Expansion trigger: when a school accumulates enough waitlist signups, add it to `schools`, seed listings, flip active.
SOURCE: IPEDS HD2023.csv filtered to `ICLEVEL=1` (4-year), `CONTROL IN (1,2)` (public + private non-profit). Committed to repo at `lib/data/schools_directory.csv`.
REJECTED: Single schools table with all IPEDS rows (pollutes feed scoping, empty feeds everywhere), hardcoded schools.ts constant of 20-30 schools (doesn't scale to waitlist demand research, misses schools we haven't thought of)

---

**[2026-06] NEXT_PUBLIC_LAUNCHED env flag for teaser/app flip**
DECIDED: Single Vercel project, single domain. `app/page.tsx` renders `<TeaserPage />` when `NEXT_PUBLIC_LAUNCHED=false` and `<BrowsePage />` when `true`. Flip = change one env var in Vercel dashboard → redeploy.
REASON: Simplest possible mechanism. No DNS changes, no domain transfer, no second Vercel project to manage. The teaser and the app are in the same repo so shared components (school combobox, Supabase client) don't need to be duplicated.
REJECTED: Separate Vercel project for teaser (complicates the flip, two projects to manage, shared component duplication)

---

**[2026-06] price=NULL means free, price=0 invalid**
DECIDED: `CHECK (price IS NULL OR price > 0)`. NULL = free item. price = 0 is rejected by the constraint.
REASON: Consistent semantics. NULL clearly communicates "no price" at both the DB and application layer. `price = 0` is ambiguous — is it free or is it a data entry error? Using NULL for free means every query that filters on price automatically excludes free items unless you explicitly include them, which is the right default behavior for price range filters.
REJECTED: price=0 for free (ambiguous semantics, breaks price range filter logic)

---

**[2026-06] Cursor-based pagination, not offset**
DECIDED: `WHERE l.created_at < $cursor ORDER BY l.created_at DESC LIMIT 20`. Cursor = `created_at` of the last item on the previous page.
REASON: Offset pagination has a classic bug on active feeds: if a new listing is inserted while a user is on page 2, every row shifts by one — the user sees a duplicate from page 1 or skips a listing. Cursor-based pagination is stable across new inserts. Also avoids the performance degradation of large OFFSETs (Postgres must scan and discard N rows).
REJECTED: LIMIT/OFFSET (duplicate/skip bug on active feeds, performance degrades at large offsets)

---

**[2026-06] Category as CHECK constraint enum, not free text**
DECIDED: `CHECK (category IN ('electronics','furniture','clothing','textbooks','appliances','bikes','free','other'))`
REASON: Free text categories break filtering immediately. "Electronics", "electronic", "ELEC", "Electornics" — four strings, one intended category, broken filter. The constraint enforces consistency at the DB level, not just the application layer.
REJECTED: Free text category (normalization nightmare, filter breaks on first typo)

---

**[2026-06] Generated slug for profile URLs, not UUID**
DECIDED: `slug = slugify(display_name) + '-' + randomHex(4)`. Example: "Alex Kim" → `alex-kim-7f2a`. URL: `/u/alex-kim-7f2a`.
REASON: UUIDs like `550e8400-e29b-41d4-a716-446655440000` are not human-readable or shareable. Slugs are. Generated (not user-chosen) avoids needing a username reservation system, uniqueness checks at user input time, and reserved word lists. 4-char hex suffix = 65,536 possible values per base slug — collision probability is negligible.
REJECTED: UUID-based URLs (not shareable), user-chosen usernames (reservation system, reserved words, uniqueness UX complexity)

---

**[2026-06] Demand posts and matching engine deferred to v2**
DECIDED: `listing_type` and `quantity` columns added to `listings` schema now (defaulting to 'supply' and NULL). All v2 tables (listing_matches, negotiation_preferences) in schema now. UI for demand posts not built until after supply-side launch validation.
REASON: Demand posts are meaningless without supply-side critical mass. A "I need 6 chairs" post at a school with 5 active listings will never be matched. The September launch builds the supply base that makes v2 valuable. Putting the columns in schema now means v2 requires no migration — only UI work.
REJECTED: Building demand posts for MVP (wrong phase, needs supply mass first), not putting columns in schema (would require migration later)

---

**[2026-06] AI dealer deferred to v3, contingent on v2 validation**
DECIDED: `negotiation_preferences` table in schema. AI dealer not built until v2 demand post usage is proven.
REASON: AI negotiation is only valuable if: (a) demand posts exist and are used, (b) matches are happening but negotiations stall. Neither can be observed until v2 ships. Building the AI layer speculatively risks 4–6 weeks of work on a feature with no validated use case. The table exists so no migration is needed when the time comes.
CONSTRAINT: AI dealer can propose a deal but cannot commit on a user's behalf. Both parties must confirm. This is non-negotiable — removing human confirmation creates dispute liability.
REJECTED: AI dealer in v2 (no validated demand yet), AI dealer with autonomous commit (trust and dispute liability)

---

**[2026-07-09] Project docs live in info/ folder**
DECIDED: CLAUDE.md, DECISIONS.md, BUILDORDER.md, and UniMarket_Technical_Spec.md live in `info/` at the repo root. Application code lives at the repo root itself.
REASON: Keeps planning/context docs separated from the codebase. Session start instruction: read the three docs from `info/`.
REJECTED: Docs at repo root (clutters the code tree as the app grows)

---

**[2026-07-09] Tool ownership currently personal, must migrate to zunio before launch**
DECIDED: Flagged as a required migration, not yet performed. GitHub repo, Supabase project, and Resend account are all currently created/owned under the technical co-founder's personal email and personal GitHub account. These need to be transferred to (or have zunio added as owner on) a zunio-owned account before production launch.
REASON: Personal-account ownership of production infrastructure is a single point of failure and a business risk (co-founder disputes, account recovery, offboarding). Tracked as BUILDORDER item 0.9b and gated again in the 2.13 pre-launch checklist so it isn't missed.
STATUS: Not yet done as of 2026-07-09. Best done before Vercel is connected to the GitHub repo (0.10), since migrating repo ownership after Vercel is linked requires re-linking the Vercel project.
REJECTED: Deferring until right before launch (higher risk of being forgotten under launch pressure; more state — Vercel links, deployed envs, DNS — would need to move at once)

---

**[2026-07-09] Product name finalized: Zunio, parent company Athenova**
DECIDED: Working name "UniMarket" is replaced with the final product name **Zunio**. Parent/holding company is **Athenova**. Both have full brand assets (logo lockups, symbols, favicons, reversed variants) provided by the user in `/Users/anhbui/zunio-design-materials/`.
REASON: Branding finalized — design and logo package delivered, confirming Zunio as the real product name rather than a placeholder.
REJECTED: Continuing to use "UniMarket" as a placeholder now that a final name exists.

---

**[2026-07-09] Centralized design tokens, no inline styles**
DECIDED: All colors, border radii, and shadows live in `lib/design-tokens.ts` as the single canonical source. `tailwind.config.ts` imports from it and exposes them as `brand.*` Tailwind classes (e.g. `bg-brand-emerald`, `rounded-lg`, `shadow-md`). Components use only these utility classes — no inline `style` attributes, no ad-hoc hex values anywhere in JSX. The one unavoidable exception is `lib/resend.ts` (email HTML requires inline styles for client compatibility), which imports the same `colors` object from `lib/design-tokens.ts` rather than duplicating hex values.
REASON: User requirement — styling must be centralized and universal across the product, not scattered as inline/magic values, so a palette or type change is a one-file edit.
REJECTED: Inline Tailwind arbitrary values or raw hex scattered through components (works initially, drifts out of sync immediately once more than one person or session touches styling).

**[2026-07-09] Fonts: Inter (body) + Plus Jakarta Sans (display/logo)**
DECIDED: Inter for body/UI text, Plus Jakarta Sans for headlines and the logo wordmark, both loaded via `next/font/google` in `app/layout.tsx` and exposed as `font-sans` / `font-display` Tailwind classes.
REASON: The provided logo SVG (`llc_logos/zunio-lockup.svg`) has its "zunio" wordmark set in Plus Jakarta Sans at weight 800 — that's the true brand typeface. The landing page mockup (`zunio_landing_page_v5.html`) uses Inter throughout for body copy. Rather than pick one, used each font where it's the strongest signal of intent: brand type for headlines/logo, Inter for everything else. The logo's wordmark is rendered as real HTML text in this font (not the SVG's embedded `<text>`) since `<img src="...svg">` doesn't reliably load referenced web fonts.
REJECTED: Using only Inter everywhere (loses the brand identity signal from the actual logo asset), embedding the SVG's text directly (font wouldn't render correctly via `<img>`, and it's not real/accessible/selectable text).

---

**[2026-07-23] Start Phase 1 before Phase 0 fully deployed**
DECIDED: Begin Phase 1 (Foundation — auth, browse page, listing creation) starting with item 1.2, even though Phase 0 items 0.9b (account migration), 0.10 (Vercel deploy), and 0.11 (launch email draft) are not yet done. This deviates from the explicit BUILDORDER.md rule: "Do not start a phase until the previous phase is complete and deployed."
REASON: The remaining Phase 0 items are blocked on external, non-technical dependencies — domain purchase and DNS access from a friend, and account-ownership transfers — not on undone engineering work. Phase 1 work (Supabase Auth, browse page, listings) doesn't require the production domain or a live deploy; it works fine locally and on Vercel preview URLs. Sitting idle while waiting on other people has no upside.
REJECTED: Waiting for 0.9b/0.10/0.11 to complete before starting any Phase 1 work (idle time with no technical reason to wait).

---

**[2026-07-23] Sign-up school picker cannot reuse the teaser's SchoolCombobox**
DECIDED: Built a separate `ActiveSchoolSelect` component for the sign-up form, querying the `schools` table (active/launched only) directly, rather than reusing `SchoolCombobox` (which searches `schools_directory`, the full ~2,510-school IPEDS list). Fetches the full active-schools list once and filters client-side, rather than debounce-searching per keystroke, since `schools` is small and manually curated by design.
REASON: `waitlist.school_id` FKs to `schools_directory.id`; `users.school_id` FKs to `schools.id`. These are different UUID spaces. BUILDORDER item 0.6 said the combobox would be "used on teaser page AND main app sign-up form (same component)" — this was incorrect given the canonical schema's split-table design (documented separately as "Schools architecture — decided"). Passing a `schools_directory.id` into `users.school_id` would violate the FK constraint. Caught this before shipping by verifying the insert against the real FK constraint via a one-off test (see BUILDORDER 1.2 notes), not by inspection alone.
REJECTED: Reusing SchoolCombobox as originally speced (would break sign-up for every user — FK violation on every insert), collapsing schools/schools_directory to avoid the mismatch (already rejected elsewhere in this log — feed scoping needs the split).

---

**[2026-08-03] Own email verification system, not Supabase Auth's built-in confirmation**
DECIDED: Disabled Supabase's "Confirm email" project setting entirely (`supabase/config.toml` → `[auth.email] enable_confirmations = false`, pushed via `supabase config push`). Sessions now issue immediately on sign-up. Built a separate, custom verification system: `users.email_verified_at` (nullable timestamp, publicly readable like the rest of a profile) plus a new `email_verifications` table (`user_id`, `token`) holding the single-use token — that table has RLS enabled with **no policies at all**, service-role only, matching the existing `negotiation_preferences` pattern, specifically so the token never leaks through the `users` table's public "read user profiles" policy. Verification emails send via Resend (`lib/resend.ts`), not Supabase's built-in mailer.
REASON: Supabase's confirm-email gate is all-or-nothing at the project level — with it on, GoTrue refuses to issue *any* session (sign-up or sign-in) until the user clicks Supabase's own confirmation link. That directly contradicts the already-decided UX ("Unverified account state" section of this file): browse freely while unverified, blocked only from posting. There is no supported way to get "session now, still flagged unverified" out of Supabase's own confirmation system — the only action that grants a session (completing confirmation) is the same action that marks the account confirmed. Using Resend instead of Supabase's mailer also sidesteps Supabase's free-tier mailer limit (2 emails/hour), which blocked live testing multiple times earlier in this project (see docs/CHANGELOG.md) and is a real risk for actual users at launch, not just during dev.
REJECTED: Manually minting a session via Supabase's admin API right after sign-up while leaving Supabase's own `email_confirmed_at` unset (investigated and rejected — every documented way to get GoTrue to issue a token for a user is itself a confirmation action, so there's no clean way to decouple "has a session" from "Supabase considers them confirmed"). Accepting Supabase's default (no session until their link is clicked) — rejected because it silently drops the "browse while unverified" decision already made and documented, not just a implementation simplification.

---

**[2026-08-03] Sign-up allows any school; posting requires domain-matched school-email verification**
DECIDED: Two related changes to the auth/school model:
1. Sign-up's school picker searches the full `schools_directory` (~2,510 schools), not just launched ones. `users.school_id` still FKs to `schools` as before, but the sign-up route now auto-creates an inactive `schools` row (`active: false`, `directory_id` set) the first time someone picks a school with no row yet, via `getOrCreateSchool()` in `lib/schools.ts`.
2. Posting (`is_seller_verified`) is now decoupled from generic email verification (`email_verified_at`). When a verification link is clicked, the route checks whether the verified email's domain matches the user's school's domain (`schools_directory.domain`) and only then sets `is_seller_verified`. A new `/account/add-school-email` flow lets an account originally signed up with a personal email later verify a matching school email and unlock posting, without re-verifying their original email.
REASON: The previous design (sign-up restricted to launched schools; any verified email unlocked posting) had two real problems, both raised by the user: (a) it blocked legitimate use cases — a real student who happens to be near/interested in a school we haven't launched (e.g., an internship, a visiting student, a friend elsewhere) couldn't even create an account; school-launch status should only gate the *browse* experience, not account creation. (b) it was a genuine trust/safety gap — `is_seller_verified` already existed in the schema specifically to mean "verified school email" (see the pre-existing "Adding .edu after sign-up" decision), but no code ever set it; the posting gate was actually checking generic email ownership, meaning anyone with any email could post, undermining the "every seller is a verified student" premise the whole product is pitched on.
REJECTED: Making `users.school_id` nullable for buyers with no campus affiliation — considered and rejected; buying/messaging a seller already doesn't require `is_seller_verified`, only a session, so a non-student buyer isn't blocked by anything meaningful today. Picking *a* school at sign-up is just "which feed do you land on by default," not a claim of affiliation, so a nullable column wasn't worth the ripple effect into browse/profile/school-switcher logic for a benefit that's already achieved another way.

---

**[2026-08-07] Abuse protection deferred to pre-launch; Turnstile preferred over reCAPTCHA**
DECIDED: Neither CAPTCHA nor rate limiting is built now. Both are gated as blockers on the 2.13 pre-launch checklist (full implementation notes live in BUILDORDER.md under "ABUSE PROTECTION DEFERRED"). When built, use **Cloudflare Turnstile**, not Google reCAPTCHA.
REASON (deferral): Investigating the original concern — one person spamming the submit button — found it already covered three ways: both forms disable the button mid-submit; `waitlist.email` has a unique constraint and duplicates return success *before* reaching the email send; sign-up returns a 409 from Supabase on an existing email with no second send. The only genuine remaining gap is a bot submitting many *unique* fake emails, which is low-probability at 3 signups with no public awareness, bounded in damage (junk rows + one day of burned Resend quota), recoverable, and — since the 2026-08-05 email-tracking work — now actually *visible* rather than silent. Building the browse page (1.5/1.6) is higher-value than pre-emptive hardening against an attack nobody is currently attempting.
REASON (Turnstile over reCAPTCHA): Turnstile is usually invisible, so it adds no friction to a form whose entire purpose is conversion; it doesn't feed student behavior into Google's ad-tech or drag along the associated privacy-policy obligation; and it's IP-agnostic. That last point matters specifically for this product — an entire dorm shares one campus-wifi public IP, so per-IP rate limiting carries a real risk of mass-blocking legitimate students on launch day. Turnstile sidesteps that failure mode, making it arguably the better *single* protection here if only one is built.
REJECTED: Building either now (premature — no attack surface pressure, and a buggy rate limiter that falsely blocks real students would be worse than none). Google reCAPTCHA (privacy cost + visible friction, no implementation advantage). Migrating zunio.org DNS to Cloudflare as part of adopting Turnstile — explicitly warned against before launch, since Resend's domain verification depends on DKIM/SPF records currently at the registrar and recreating them incorrectly silently breaks all outbound email; Turnstile requires no DNS change.

---

**[2026-08-07] RLS on every table by default; column-level grants for private columns**
DECIDED: Two standing rules, established after finding both gaps live in production (see docs/CHANGELOG.md 2026-08-07). (1) **Every** table in the `public` schema gets `ENABLE ROW LEVEL SECURITY` at creation time, including tables for features not built yet — RLS-on-with-no-policies is the correct resting state for a not-yet-used table (service-role only), never RLS-off. (2) When a table has a public read policy but contains a private column, do NOT use `REVOKE SELECT (col)` — that is a Postgres no-op while the role holds table-level SELECT. Use `REVOKE SELECT ON <table>` followed by `GRANT SELECT (<safe columns>)`, and list the safe columns explicitly so adding a new sensitive column later is private-by-default rather than exposed-by-default.
REASON: `schools`, `schools_directory`, and the five v2 tables shipped with RLS off, leaving them anonymously writable — an unauthenticated DELETE could have wiped the 2,510-row school directory and broken sign-up. Separately, `users.contact_email` was world-readable because RLS filters rows, not columns. Both were only caught by actively attacking production with the public anon key rather than reading the schema; Supabase's Security Advisor caught the first class but is blind to the second, so neither tool nor inspection alone is sufficient.
REJECTED: Relying on RLS alone for column privacy (structurally cannot do it). Deferring RLS on v2 tables until those features are built (leaves a live hole in the meantime, and the day chat ships every DM would be public). Trusting that application code never selects a private column (irrelevant — PostgREST lets anyone query the table directly with the anon key, bypassing the app entirely).

---

**[2026-08-19] Launch at two schools — Northeastern and DePauw; school slugs are curated, not auto-generated**
DECIDED: MVP launches at **both** Northeastern (Boston) and DePauw (Greencastle), not one school. Both `schools` rows are now `active: true`. `launched_at` stays NULL for DePauw until the `NEXT_PUBLIC_LAUNCHED` flip — that column records when students actually get access, not when the row was configured. Separately, DePauw's slug was renamed `depauw-university-0305` → `depauw-greencastle` to match Northeastern's `northeastern-boston` school-campus convention.
REASON (two schools): One co-founder is at Northeastern, the other is a DePauw alum, so both campuses have a personal channel for the cold-start push. Waitlist distribution at the time of the decision was thin and spread wide — 6 signups across 5 schools (Northeastern 2, DePauw 1, and one each at Boston Architectural College, Furman, and U. Cincinnati) — so no single school had enough demand to justify launching alone.
REASON (slug rename): The DePauw row was created implicitly by `getOrCreateSchool()` during a sign-up test, which calls `generateSlug()` and appends a random 4-hex suffix — fine for the inactive placeholder rows that function exists to create, wrong for a launch school. Slugs are UNIQUE, human-facing identifiers that will end up in URLs; renaming costs nothing at zero users and is disruptive later. Standing rule: any school promoted to `active: true` gets its slug curated to the `school-campus` pattern first.
CONSEQUENCE: Cold start (BUILDORDER 2.12) now has to fill **two** empty feeds, and DePauw has no on-campus founder presence, so its seed listings need a deliberate plan rather than ambient momentum. This is the dominant launch risk — a launch blast currently reaches 6 people, so day-one inventory will come from seeding, not from the waitlist.
REJECTED: Launching Northeastern-only (leaves the DePauw co-founder relationship unused, and Northeastern's 2 signups aren't decisively better). Leaving DePauw's auto-generated slug (bakes a meaningless `-0305` suffix into a permanent public identifier). Setting `launched_at` now (would misrepresent launch date in any future "member since"/analytics query).

---

**[2026-08-19] Structured names + user-chosen username replaces display_name/slug**
DECIDED: `users` now stores `first_name` (required), `last_name` (nullable), and `username` (required, unique). `display_name` is a GENERATED ALWAYS column (`first_name || ' ' || last_name`, first name alone when last is NULL) and `slug` is dropped entirely — `username` is the profile URL (`/u/[username]`). Usernames are stored canonically lowercase, 3–30 chars, `[a-z0-9._]` with no leading/trailing separator, checked against a reserved-name blocklist, and NOT user-changeable at MVP. Profiles display the real name with the handle beneath it (the Venmo pattern).
REASON (structured names): `display_name` was a single free-text field, not unique, so students had no reliable way to find each other — the thing the product's trust model depends on.
REASON (username replaces slug): keeping both would mean two identifiers for one person that can drift apart, which is exactly the class of inconsistency this change exists to remove. The old `generateSlug()` also stripped every non-ASCII character, so a name in a non-Latin script produced a slug like `-7f2a`; a user-chosen ASCII username fixes that for international students rather than mangling their name.
REASON (generated display_name): a denormalized copy alongside first/last would go stale the first time someone edits their name in account settings (2.6). Making it generated means it *physically cannot* disagree — verified: a direct UPDATE is rejected with `428C9 column "display_name" can only be updated to DEFAULT`.
REASON (lowercase storage + DB constraint): case-insensitive uniqueness must be enforced by the database, not the app — an application "is it taken?" check loses to two concurrent sign-ups (both read, both see it free, both insert). The format CHECK forbids uppercase outright, so mixed-case duplicates are rejected at the constraint level (23514) before uniqueness (23505) is even reached. The `/api/auth/username-available` endpoint is an advisory hint only; the sign-up route handles losing the race with a 409.
REASON (last_name optional): mononyms are common among Indonesian and some South Indian students. Requiring a surname would force fake data, corrupting the real-identity signal the product is built on.
REASON (not changeable): matches the existing "slug not user-changeable at MVP" decision — avoids broken profile links and username-squatting churn without building a reservation/redirect system.
ACCEPTED COST: sign-up goes from one name field to three, against CLAUDE.md's "every extra field kills conversion" rule. Mitigated by auto-suggesting the username from the name (typing "Maya Chen" pre-fills `mayachen`) so most users never type the third field.
REJECTED: Keeping `slug` alongside `username` (two identifiers, guaranteed drift). App-level uniqueness checks (racy). Preserving user-typed casing for display (a second representation to keep in sync, for no real gain — handles are conventionally lowercase). Requiring last_name.

---

**[2026-08-19] Known consistency gaps found during the username audit — NOT yet fixed**
Recorded so they are not rediscovered as surprises. Both are real and both have a scheduled home.
1. ~~**Seller verification fails for subdomain school emails.**~~ FIXED 2026-08-19 — see the school-email decision entry below and CHANGELOG 2026-08-19.
2. ~~**Changing school moves every past listing with the user.**~~ FIXED 2026-08-19 by migration 017 — see the cross-campus selling entry below.

---

**[2026-08-19] School email matching: subdomain rule as the base, additive per-school allowlist for exceptions**
DECIDED: Seller verification accepts an email whose domain equals the school's directory domain, is a STRICT SUBDOMAIN of it, or appears in the school's `schools.email_domains` array (migration 016). Logic lives in `lib/school-email.ts`, isolated from any route because it is the gate for the product's core trust claim.
REASON (subdomain over exact match): `schools_directory.domain` is the IPEDS `WEBADDR` — the school's *website*, not its mail domain. Universities routinely host student mail on a subdomain (`mail.uc.edu`, `g.harvard.edu`, `students.x.edu`), so exact matching silently locked out real students. The subdomain rule covers every such school with zero per-school configuration.
REASON (rejected a strict curated allowlist as the base rule): it would require researching each school's true mail domain up front, and every mistake is a *silent lockout of a legitimate seller* — the most damaging possible failure during a launch that needs sellers. The allowlist is therefore additive, used only for schools whose mail domain is not derivable from their website domain, so leaving it NULL is always safe.
REASON (dot boundary is mandatory): `endsWith(schoolDomain)` would be a live vulnerability, not a theoretical one — `uc.edu`, `buc.edu`, `puc.edu`, `luc.edu` and `huc.edu` are all distinct institutions in the directory, so `buc.edu` would verify as University of Cincinnati. Matching requires `.` + domain.
THREAT MODEL NOTE: `evil.depauw.edu` matching is not exploitable by an outsider — subdomains of `depauw.edu` can only be created by whoever controls DePauw's DNS, unlike `evil-depauw.edu` which is a separately registrable domain (and is rejected). Residual risks accepted: subdomain takeover via dangling DNS (hard to weaponise for mail, which needs MX control), university-delegated subdomains, and alumni subdomains — the last already an accepted limitation in CLAUDE.md.
DATA AUDIT (2026-08-19, 2,496 domains): 2,389 `.edu`, 57 `.com`, 43 `.org`, 7 other. **Zero free-email providers** — a `gmail.com` row would have been an instant bypass for anyone with a Gmail account. `.edu` cannot be bought (EDUCAUSE restricts it to accredited US institutions), so the trust holds for the 2,389; the 107 `.com`/`.org` schools are weaker, since a lapsed domain is registrable. Neither launch school is affected. Separately, 85 directory domains are subdomains of another school's domain (e.g. `oakland.northeastern.edu` under `northeastern.edu`, and the CUNY / Hawaii / Maine systems). This is NOT a defect — do not "fix" it. `is_seller_verified` answers one question: *is this a real student?* A Northeastern Oakland student verifying while sitting in the Boston feed is a genuine Northeastern student, so the check succeeded. Which campus feed they browse is chosen by the student at sign-up, not decided by the domain rule. Note the domain check does incidentally do a second job — it ties the person to the school they claimed, so a Harvard student picking Northeastern gets no verification at all, since the domains are unrelated. Sibling-campus looseness is the only slack in that secondary effect, and it is acceptable.
OPERATIONAL: every failed domain match logs a `console.warn` with the email domain and the school's configured domains, so a school with an unusual mail domain shows up in logs instead of quietly blocking its students. A repeated domain there is the signal to add it to `schools.email_domains`.
REJECTED: exact-match-only (silent lockouts). `endsWith` without the dot boundary (cross-verifies real institutions). Requiring `.edu` specifically (107 legitimate institutions in the directory do not use it).

---

**[2026-08-19] A listing belongs to a campus, not to its seller's campus**
DECIDED: `listings.school_id` (migration 017) records which campus feed a listing appears in. It is chosen at creation, defaults to the seller's own school, and may be any ACTIVE school — validated server-side, since a client could otherwise file a listing into an unlaunched campus where nobody would see it. Browse and search now scope on `listings.school_id` (migration 018). The seller's own school stays `users.school_id` — their verified identity — and is displayed on listing cards and the detail page.
REASON: the motivating case was "a Harvard student living near Northeastern wants to sell". Tracing it showed verification was never the blocker — that student verifies fine against `harvard.edu`, and the school switcher already let them browse Northeastern. The blocker was that listings inherited the seller's school, so their couch landed in Harvard's unlaunched feed where nobody would ever see it. Boston has Harvard, Northeastern, BU, MIT and Tufts within a few miles, so cross-campus selling is the norm there, not an edge case.
REASON (kept verification tied to the chosen school): the alternative considered was matching the email against ANY of the 2,496 directory domains, so that verification proved only "is a student somewhere". Rejected — it proves strictly less, and it would not have helped the motivating case at all. Matching against the school the person claims is what makes the check meaningful: a Harvard student who picks Northeastern gets no verification, because the domains are unrelated.
REASON (show the seller's real school): with feeds decoupled from sellers, a listing in the Northeastern feed may come from a DePauw student. Displaying the seller's actual school keeps that honest and preserves the verified-student trust signal, rather than implying everyone in a feed attends that school. On the card it gets its own line so it can't truncate away next to the name.
ALSO FIXED: the sign-up school field's helper text said it "sets your default browsing feed", which invited people to pick a campus they liked rather than the one they attend — while that same field gates verification. Copy now says it is the school you actually attend, and notes you can browse and sell at other campuses regardless.
VERIFIED LIVE: a DePauw-verified seller posted into the Northeastern feed; the item appeared in Northeastern's browse and search results attributed to "Riley Cross — DePauw University", was absent from DePauw's feed, and their other listings defaulted correctly to DePauw. A nonexistent/unlaunched school id was rejected with 400. Test data removed.
REJECTED: verifying against any accredited domain (proves less, doesn't solve the case). Letting a listing target an inactive school (invisible feed). Deriving the displayed school from the listing's campus rather than the seller (would misrepresent a DePauw student as Northeastern).

---

**[2026-08-19] Realtime in-app chat replaces the email-relay contact flow for MVP**
DECIDED: Buyer↔seller messaging is live in-app chat (Supabase Realtime) plus a throttled email notification, replacing BUILDORDER 2.1/2.2's `contact_requests` email relay. This overrides CLAUDE.md's "do not suggest real-time chat for MVP / UI is v2" and moves item 3.5 forward. Founder's call, made explicitly after reviewing the cost: live updates without a refresh were stated as the key requirement, on the reasoning that the app has to feel good for users to grow.
SCOPE ACCEPTED: ~3-5 days against a Sept 5 launch with Phase 2 largely unbuilt. Safest slips identified if needed: the expiry cron (2.7/2.8 — nothing can expire before ~Oct 5 anyway) and the image-cleanup webhook (2.10, storage cost only). `contact_requests` stays in the schema, unused.
BUILD ORDER (deliberate): RLS policies → thread UI + persistence → email notification → Realtime subscription. The first three are required in every version, and Realtime is a strict addition on top of them, so running out of time degrades to working in-app messaging rather than a half-finished feature.
SECURITY — the load-bearing part: `conversations`, `conversation_participants` and `messages` had RLS enabled with NO policies since migration 008, whose comment warned they "must NOT be left open until then, or private DMs would be world-readable the day chat ships". Migration 019 adds participant-scoped SELECT policies. Realtime makes these doubly critical: Postgres Changes evaluates the SELECT policy per subscriber, so a loose policy doesn't merely expose rows to a query — it actively pushes other people's messages into a browser as they are written. Verified live with three real accounts: a participant received a message over the socket, a signed-in non-participant subscribed to the same channel received nothing, and anonymous reads returned nothing.
`is_conversation_participant()` is SECURITY DEFINER out of necessity, not convenience — the natural participants policy must query `conversation_participants`, which re-triggers itself and raises infinite recursion (42P17). `search_path` is pinned so the body can't be redirected to a same-named malicious table.
Writes are server-side only: no INSERT policy on conversations or messages, so a client cannot bypass rate limiting by writing to the table directly. `conversation_participants` has an UPDATE policy for marking threads read, narrowed by a COLUMN GRANT to `last_read_at` alone (migration 020) — RLS filters rows, not columns, so without that grant a client could also write `last_notified_at` and silence its own notifications.
RATE LIMITS: CLAUDE.md's "3 contact requests per listing" doesn't map to chat — an ordinary exchange exceeds it. The structural equivalent is the UNIQUE (listing_id, buyer_id) constraint: one thread per listing per buyer. The real spam shapes are limited instead — 5 new conversations/hour (blasting many sellers) and 60 messages/hour (flooding).
NOTIFICATIONS: throttled to once per 15 minutes per conversation, and skipped entirely if the recipient read the thread recently — otherwise an active back-and-forth generates a dozen emails, trains people to ignore them, and burns the shared Resend quota that sign-up verification depends on. `last_notified_at` is stamped only after a confirmed send, so failures stay retryable. Notification is fire-and-forget: a failed email must never turn a delivered message into an error the sender sees. Message content, sender name and listing title are ALL user-authored and HTML-escaped via `escapeHtml` — unescaped, a message could inject an `<a>` tag and turn a Zunio-branded email, trusted precisely because it comes from our verified domain, into a phishing vehicle.
GATE: messaging requires a verified email address but NOT `is_seller_verified` — buying and contacting stay open to anyone per the earlier decision, while a throwaway unverified account still can't make our domain send mail.
IMPLEMENTATION TRAP (cost hours if rediscovered): `supabase.realtime.setAuth(session.access_token)` is REQUIRED before subscribing. Without it the socket authenticates as anon, RLS filters every row, and the channel still reports `SUBSCRIBED` while silently delivering nothing — it looks wired up and works for no one.
VERIFIED LIVE: "Message seller" creates the thread and resumes it on repeat clicks (no duplicates); a message sent from outside the browser appeared in an open thread with no reload (`navigationsSinceLoad: 1`); sending from the composer worked; empty/over-1000-char messages rejected 400; a conversation the caller isn't in returns 404 (same response as nonexistent, so ids can't be probed); messaging your own listing rejected 400; a non-participant gets 404 on the thread URL and an empty inbox; the notification email sent and `last_notified_at` was stamped. All test users, listings, conversations and messages removed afterward.
TESTING NOTE: notification tests sent to nonexistent `@zunio.org` addresses, which bounce. Use real or Resend-sandbox recipients for email tests — repeated bounces to your own domain can degrade sending reputation.
REJECTED: email relay only (no in-app history; the stated requirement was live updates). In-app threads without Realtime (would have needed a refresh, which was the one thing explicitly asked for). Client-side message INSERT via RLS (would bypass rate limiting and the notification path).

---

*Append new decisions below as they are made. Never delete or modify existing entries.*
