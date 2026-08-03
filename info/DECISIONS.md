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

*Append new decisions below as they are made. Never delete or modify existing entries.*
