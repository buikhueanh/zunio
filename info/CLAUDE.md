# Zunio — Project Context for Claude Code

This file is the single source of truth for the project. Read it fully before making any suggestions, writing any code, or answering any architecture questions. Every decision here was made deliberately — do not suggest alternatives unless a new constraint changes the tradeoff.

Also read DECISIONS.md and BUILDORDER.md before starting any session.

**Location of project docs:** CLAUDE.md, DECISIONS.md, BUILDORDER.md, and UniMarket_Technical_Spec.md live in the `info/` folder at the repo root — not at the root itself. All application code (app/, components/, lib/, supabase/, etc.) lives at the repo root.

MAKE SURE TO TEST EVERYTHING THOROUGHLY, writing unit test that covers happy path and edge cases. Always check if any security leakage potential could happen

---

## What we're building

A web app where university students can buy and sell used items — think Facebook Marketplace but scoped to a single campus, with real student identity. Product name: **Zunio**. Parent company: **Athenova**.

**The core insight:** Craigslist and Facebook Marketplace have no trust layer. Our moat is that every seller is a verified student at a real university. Buyers know who they're dealing with.

**Co-founders:**
- Technical co-founder (recent CS grad) — handles all engineering
- Business co-founder (Northeastern International Business student) — handles marketing, partnerships, growth

**Target launch: September (MVP)**

---

## Current build phase: TEASER PAGE (Phase 0)

Before the main app is built, a teaser page goes live at the production domain. It collects waitlist signups (email + school) and flips to the real app at launch via an env flag. See BUILDORDER.md for the task checklist.

---

## MVP scope — locked

### In scope
- Auth (sign up / sign in)
- Post a listing
- Browse and search listings
- Contact seller (email relay — not in-app chat)
- Mark listing as sold

### Explicitly out of scope for MVP
- Payments / transactions
- Real-time in-app chat
- Ratings and reviews
- Saved items / wishlist
- Push notifications
- Sublets (future phase)
- Social login (Google, Apple) — email/password only at MVP
- Demand posts / reverse auction (v2)
- AI dealer / negotiation (v3)

---

## Tech stack — decided

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Fastest path to MVP, SSR for SEO, one codebase |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) | Relational model fits marketplace, Auth handles .edu filtering, Storage handles images, no vendor lock-in |
| Hosting | Vercel | Free tier, git-push deploys, preview URLs for non-technical partner |
| Styling | Tailwind CSS | Speed |
| Language | TypeScript | Supabase auto-generates types from schema; catches null errors at compile time |
| Email | Resend (free tier → paid at launch) | Contact seller flow, listing expiry notifications, waitlist confirmation, launch email blast |

### What was evaluated and rejected

- **MongoDB:** Marketplace data is deeply relational. Aggregation pipeline is harder to maintain than SQL JOINs for this domain. Atlas Search requires paid tier ($57/mo). No built-in auth or storage.
- **Firebase:** High vendor lock-in. Firestore query model breaks for relational data. Multiple companies have written post-mortems about painful Firebase migrations.
- **React Native / Flutter:** App store delays, two codebases, push notifications out of scope. Web-first + PWA covers mobile for launch.
- **Docker / Kubernetes:** Not needed. Vercel + Supabase handle all infra. Revisit only when there is a real ops problem.
- **Snowflake / Redis:** Wrong phase. Zero users = zero need for data warehousing or caching layers.
- **Resend Audiences for waitlist:** Rejected. Waitlist is relational data — belongs in Postgres. Resend Audiences would store the most valuable pre-launch asset in a third-party email tool. Resend is delivery-only; Supabase owns the data.

**YC scale migration path:** Supabase is vanilla PostgreSQL. Outgrow it → change `DATABASE_URL` to Amazon RDS or Neon. Zero application code changes.

---

## Teaser page — decided

### Purpose
Collect waitlist signups before the app is built. Goes live at the production domain immediately. Flips to the real app at launch via a single env var change.

### The flip mechanism
```typescript
// app/page.tsx
const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === 'true'
export default function Home() {
  return LAUNCHED ? <BrowsePage /> : <TeaserPage />
}
```
At launch: set `NEXT_PUBLIC_LAUNCHED=true` in Vercel env vars → redeploy. No DNS changes. No domain transfer.

### What the teaser page collects
- Email address (required)
- School (required — searchable combobox, see school architecture below)
- "My school isn't listed" fallback → free text field for raw school name

### Confirmation behavior
- On successful signup: show confirmation state inline ("You're on the list")
- Send a confirmation email via Resend immediately (trains inbox to trust the domain before launch email)
- Duplicate email submissions: return success silently — never tell the user "already registered" (privacy leak + bad UX). Handle via unique constraint violation (Postgres error code 23505).

### Resend free tier warning
Free tier caps at 100 emails/day. If waitlist exceeds 100 signups, upgrade Resend to first paid tier ($20/mo) before sending the launch blast. Do not risk the launch email on a free tier daily cap.

---

## Schools architecture — decided (split table design)

Two separate tables. This is a firm decision — do not collapse them back into one.

### schools_directory
Full IPEDS dataset. ~2,800 rows (4-year public and private non-profit institutions in the US). Used for autocomplete everywhere: teaser school picker, main app sign-up form. Source: IPEDS HD2023.csv filtered to `ICLEVEL=1, CONTROL IN (1,2)`. Committed to repo as `lib/data/schools_directory.csv`.

```sql
CREATE TABLE schools_directory (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,        -- "Northeastern University"
  campus   text,                 -- "Boston" / NULL for single-campus
  city     text,
  state    text,
  ipeds_id text UNIQUE,          -- official IPEDS unit ID
  domain   text                  -- "northeastern.edu" where known
);
```

### schools
Active/launched campuses only. Small table, manually curated. This is what feed scoping uses. Users and listings FK to this table — not to schools_directory.

```sql
CREATE TABLE schools (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id    uuid REFERENCES schools_directory(id),
  slug            text NOT NULL UNIQUE,
  active          boolean DEFAULT true,
  launched_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

### Who references what
- `waitlist.school_id` → `schools_directory.id` (any school can join waitlist)
- `users.school_id` → `schools.id` (only active/launched schools)
- `listings` scoped via `users.school_id` → `schools.id`

### Why the split
Importing all 2,800 IPEDS schools into a single `schools` table would let users sign up with `school_id = University of Alaska Fairbanks` and get an empty feed forever. The split ensures the feed scoping table stays small and intentional while the autocomplete still feels like LinkedIn's school picker.

### Expansion trigger
When a school hits enough waitlist signups to justify launching, add a row to `schools` pointing at the relevant `schools_directory` entry, seed listings, flip `active = true`.

---

## Auth design — decided

**Model: .edu required to post/sell, anyone can browse**

- Logged-out users land directly on the browse page. No login wall — show value immediately.
- Posting a listing requires a verified `.edu` email address.
- Sign-up captures: email (.edu), display name, school (dropdown → `school_id` FK to `schools`), optional profile photo.
- Do NOT add fields at sign-up: phone, payment info, social handles, address. Every extra field kills conversion.
- No social login (Google/Apple) at MVP — OAuth email may not be .edu, adding complexity without benefit.

### Unverified account state — decided

After sign-up, Supabase sends a verification email. Until clicked:
- User can browse freely
- User sees a persistent banner: "Verify your email to post listings"
- Clicking "Post" redirects to "Check your email" screen with a resend button
- Unverified accounts auto-delete after 7 days (Supabase Auth setting)
- Do NOT block browsing for unverified users

### Alumni .edu emails — known limitation
Many schools issue .edu emails that alumni keep for life. An alumnus can post listings. Accepted for MVP. Post-MVP: add optional `graduation_year` field as a soft signal.

### Adding .edu after sign-up — decided
User signed up with personal email → wants to sell → must add and verify .edu as secondary email. Supabase supports multiple auth providers per user. Store verified `.edu` status as `is_seller_verified boolean` on users table.

---

## Proximity / location model — decided

**Model: school-based scoping with manual override. No GPS. No ZIP codes.**

The feed is scoped to a school (an institution), not a geographic radius.

### Why not GPS
- ~30% of web users deny location permission — broken default on day one
- Sellers post from home, dorms, or their hometown. GPS ≠ campus community
- PostGIS extension, spatial index, radius math, permission UI = 2–3 extra days with zero user benefit
- A student posting from home for summer still wants their listing visible at Northeastern

### Why not ZIP codes
- ZIP boundaries do not align with campuses
- Loses the student community identity
- Users do not think in ZIP codes

### How it works
School stored as `school_id uuid REFERENCES schools(id)` on `users`. Browse query: `JOIN schools s ON u.school_id = s.id WHERE s.id = $1`. School switcher sets `$1`.

**User states:**

| State | Behaviour |
|---|---|
| New visitor, not logged in | Browse page shows school picker. Selection stored in `localStorage`. Feed loads immediately, no login required. |
| Signed-up user | Default feed = home school from their profile (`school_id`). Zero friction. |
| Browsing a different school | School switcher at top of browse page changes session scope only. Does NOT change `school_id` on their account. |
| Moving to a new school | User updates `school_id` in account settings. Existing listings remain; new listings appear in new school's feed. |

### School switcher UX
Place prominently at the **top of the browse page** (not nav). First-time users must immediately understand the product is school-scoped. Default for logged-out visitors: Northeastern (most listings at launch). Store in `localStorage`. No modal on first visit.

### Multi-campus universities
"Northeastern – Boston" and "Northeastern – Seattle" are separate rows in `schools` (and `schools_directory`). Single-campus schools have `campus = null`.

### Search scope
Always scoped to current school. Every search query must include `AND u.school_id = $school_id` explicitly. Cross-school search is v2.

### Expansion roadmap
- **v2:** User follows multiple schools → merged feed
- **v3:** Region layer above school ("Boston Area" = all Boston schools). Still string/tag, no GPS.
- **v4:** Optional GPS as enhancement only — show "0.3 miles away" if user grants location. PostGIS added only here.

---

## Database schema — canonical version

This is the source of truth. Do not deviate without updating this file and DECISIONS.md.

```sql
-- Full IPEDS school directory (seeded from lib/data/schools_directory.csv)
CREATE TABLE schools_directory (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,
  campus   text,
  city     text,
  state    text,
  ipeds_id text UNIQUE,
  domain   text
);

-- Active/launched campuses only (manually curated, small)
CREATE TABLE schools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid REFERENCES schools_directory(id),
  slug         text NOT NULL UNIQUE,
  active       boolean DEFAULT true,
  launched_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- Waitlist (teaser page signups)
CREATE TABLE waitlist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  school_id       uuid REFERENCES schools_directory(id), -- NULL if unlisted
  school_name_raw text,   -- populated when school_id IS NULL
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON waitlist (school_id) WHERE school_id IS NOT NULL;

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can join waitlist"
  ON waitlist FOR INSERT WITH CHECK (true);
-- No SELECT policy — reads only via service role key in API routes

-- Users (extends Supabase Auth)
CREATE TABLE users (
  id                  uuid PRIMARY KEY REFERENCES auth.users,
  display_name        text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  slug                text NOT NULL UNIQUE,
  school_id           uuid REFERENCES schools NOT NULL,
  contact_email       text,
  is_seller_verified  boolean DEFAULT false,
  bio                 text CHECK (char_length(bio) <= 300),
  social_url          text,
  profile_photo       text,
  is_suspended        boolean DEFAULT false,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Listings
CREATE TABLE listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users NOT NULL,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description     text NOT NULL CHECK (char_length(description) <= 2000),
  price           numeric(10,2) CHECK (price IS NULL OR price > 0),
  category        text NOT NULL CHECK (category IN (
                    'electronics','furniture','clothing','textbooks',
                    'appliances','bikes','free','other'
                  )),
  condition       text CHECK (condition IN ('new','like_new','used','for_parts')),
  images          text[],
  pickup_hint     text CHECK (char_length(pickup_hint) <= 100),
  status          text DEFAULT 'active' CHECK (status IN (
                    'active','sold','expired','removed'
                  )),
  -- v2 columns (present in schema now, not exposed in UI until v2)
  listing_type    text DEFAULT 'supply' CHECK (listing_type IN ('supply','demand')),
  quantity        int  CHECK (quantity IS NULL OR quantity > 0),
  --
  search_vector   tsvector GENERATED ALWAYS AS (
                    to_tsvector('english', title || ' ' || coalesce(description, ''))
                  ) STORED,
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT now() + interval '30 days'
);

CREATE INDEX ON listings USING GIN(search_vector);
CREATE INDEX ON listings (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON listings (user_id) WHERE deleted_at IS NULL;
CREATE INDEX ON listings (listing_type, status) WHERE deleted_at IS NULL;

-- Contact requests (email relay — MVP messaging)
CREATE TABLE contact_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid REFERENCES listings NOT NULL,
  sender_id   uuid REFERENCES users NOT NULL,
  message     text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  sent_at     timestamptz DEFAULT now()
);

CREATE INDEX ON contact_requests (listing_id, sender_id);
CREATE INDEX ON contact_requests (sender_id, sent_at);

-- Blocked users (schema ready, UI built in v2)
CREATE TABLE blocked_users (
  blocker_id  uuid REFERENCES users NOT NULL,
  blocked_id  uuid REFERENCES users NOT NULL,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- v2: matching engine (schema ready, logic built in v2)
CREATE TABLE listing_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_listing_id uuid NOT NULL REFERENCES listings(id),
  demand_listing_id uuid NOT NULL REFERENCES listings(id),
  matched_at        timestamptz DEFAULT now(),
  notified          boolean DEFAULT false,
  UNIQUE (supply_listing_id, demand_listing_id)
);

-- v3: AI dealer negotiation ranges (strict RLS — never readable by client)
CREATE TABLE negotiation_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  min_price  numeric(10,2),
  max_price  numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

-- v2: in-app chat (schema ready, activate in v2 with Supabase Realtime)
CREATE TABLE conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid REFERENCES listings,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id uuid REFERENCES conversations,
  user_id         uuid REFERENCES users,
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES conversations NOT NULL,
  sender_id        uuid REFERENCES users NOT NULL,
  content          text NOT NULL,
  created_at       timestamptz DEFAULT now(),
  edited_at        timestamptz,
  deleted_at       timestamptz
);

CREATE INDEX ON messages (conversation_id, created_at DESC);
CREATE INDEX ON conversation_participants (user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Row Level Security
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active supply listings"
  ON listings FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL AND listing_type = 'supply');

CREATE POLICY "owners update own listings"
  ON listings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "owners delete own listings"
  ON listings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "public read user profiles"
  ON users FOR SELECT
  USING (deleted_at IS NULL AND is_suspended = false);

CREATE POLICY "owners update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- negotiation_preferences: only readable by service role (AI dealer)
-- No client-facing SELECT policy intentionally
CREATE POLICY "owners insert own preferences"
  ON negotiation_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## Design decisions — gaps resolved

### Auth gaps
**Unverified account flow:** Unverified users can browse. Cannot post. Persistent banner. Resend verification on demand. Auto-delete unverified accounts at 7 days.

**Account deletion:** Set `users.deleted_at = now()`. Auto-set all their listings to `status = 'removed'`. Show as "Item no longer available." Retain `contact_requests` for 90 days. Hard delete after 90 days via cron.

### School / location gaps
**School as FK, never free text.** `users.school_id` → `schools.id`. Display name from `schools` JOIN `schools_directory`. Free-text school input rejected — one typo creates a ghost school.

**Multi-campus:** Separate rows in both `schools` and `schools_directory` with `campus` column.

**Default school for logged-out users:** Default to Northeastern. Store in `localStorage`. No modal.

**Multi-school listings:** Not supported at MVP. One listing = one school.

### Listings gaps
**Category is a CHECK constraint enum.** Not free text. Valid values: electronics, furniture, clothing, textbooks, appliances, bikes, free, other.

**Price rules:** NULL = free. price > 0 enforced. price = 0 is invalid — use NULL. Price filter slider: $0–$1000 + "Over $1000" bucket.

**Image ordering:** First uploaded = thumbnail. UI copy: "First photo will be your cover image." No drag-to-reorder at MVP.

**Edit listing:** Same form as create, pre-filled. Does NOT change `created_at`. Only `updated_at` changes. Show "Edited" badge if `updated_at > created_at + 1 hour`.

**Active listing cap:** Max 10 active listings per user. Enforced in API route (COUNT check before insert).

**listing_type and quantity columns:** Present in schema now. `listing_type` defaults to 'supply'. These columns are invisible in MVP UI — they exist so v2 demand posts require no migration.

### Browse / search gaps
**Search always school-scoped.** Every query includes `AND u.school_id = $school_id`.

**Zero results state:** "No listings for '[query]' at [school]. Browse all listings ↗" — never a blank grid.

**Cursor-based pagination.** Cursor = `created_at` of last item. `WHERE l.created_at < $cursor ORDER BY l.created_at DESC LIMIT 20`.

**Sort options:** newest (default), price low→high, price high→low. Search results: relevance (ts_rank) as default.

### Contact / messaging gaps
**Rate limiting:** Max 3 contact requests per buyer per listing. Max 10 per buyer per hour. Both checked before insert. HTTP 429 on violation.

**Seller's contact email:** `contact_email` column on users. Defaults to auth email. User can change to Gmail. Resend sends to `contact_email`, not auth email. Solves never-checked .edu inbox problem.

**Buyer email exposure:** Reply-to = buyer's email. Seller sees it when they reply. Intentional for MVP. Document in UI.

### User profile gaps
**Slug:** `display_name_slug + '-' + 4_char_hex`. URL: `/u/[slug]`. Not user-changeable at MVP. Not UUID-based.

**Display name:** 2–40 chars. Not unique. Profanity filter via `bad-words` npm at API layer.

**Social URL validation:** Must start with `https://instagram.com/`, `https://linkedin.com/in/`, `https://twitter.com/`, `https://x.com/`. Render with `rel="noopener noreferrer" target="_blank"`.

**User blocking:** `blocked_users` table in schema. Data layer ready. UI is v2.

### Trust & safety gaps
**Moderation:** Report button → email to moderation inbox. Admin manually sets `listings.status = 'removed'` or `users.is_suspended = true` via Supabase dashboard SQL. No admin UI at MVP.

**AUP checkbox:** Required on listing creation before submit. Shifts legal responsibility to poster.

**Prohibited items:** Defined in AUP — weapons, controlled substances, prescription medication, alcohol, adult content, counterfeit goods.

**Image content:** Accept risk at MVP. Post-MVP: Google Cloud Vision SafeSearch (async, free tier 1000/month).

### Data integrity
**Soft delete convention:** All user-facing tables use `deleted_at timestamptz`. All queries add `WHERE deleted_at IS NULL`. `listings` keeps `status` for business states AND `deleted_at` for moderation — orthogonal.

**`updated_at` on all mutable tables:** `listings` and `users` have auto-update trigger.

**Image cleanup:** Supabase Database Webhook on listings UPDATE → Edge Function deletes Storage objects. Weekly cron as fallback.

---

## v2 design — demand posts and matching engine

Documented here so implementation is not invented from scratch. Do not build for MVP.

### Concept
Supply post: seller has something. Demand post: buyer needs something. Both live in the `listings` table, distinguished by `listing_type`.

### listing_type semantics
- `'supply'` (default): seller has item, asking price
- `'demand'`: buyer wants item, price = budget ceiling

### Matching engine
Triggered in both directions:
- New supply post → query active demand posts at same school, same category, compatible price → notify matching buyers
- New demand post → query active supply posts at same school, same category, compatible price → notify matching sellers

Price compatibility: `supply.price <= demand.price` (seller asks ≤ buyer's budget).
Uses existing `search_vector` + `plainto_tsquery` for keyword overlap.
Writes to `listing_matches` (unique constraint prevents duplicate notifications).

### v3: AI dealer
Reads `negotiation_preferences` (private price ranges, never client-readable).
Proposes a deal to both parties when ranges overlap.
Both parties must confirm — AI cannot commit on anyone's behalf.
Only built after v2 shows demand post usage is real.

---

## User flow

### Browse page (unauthenticated landing)
- School switcher prominently at top
- Listing grid, newest first, school-scoped, supply only
- Filters: category, price range ($0–$1000 + "Over $1000"), free items toggle, condition
- Sort: newest, price low→high, price high→low
- Full-text search bar (scoped to current school)
- Cursor-based pagination ("Load more")
- Zero-results: "No listings for '[query]' at [school]. Browse all ↗"
- Empty school state: "Be the first to sell here" CTA

### Listing detail page
- Title, description, price (or "Free"), condition, category, photos, pickup hint, posted date
- "Edited" badge if `updated_at > created_at + 1 hour`
- Seller card → links to seller profile
- "Message seller" button → contact form (requires login)
- "Mark as sold" visible only to listing owner
- "Report this listing" link

### Contact seller flow (email relay — MVP)
1. Buyer enters message (10–1000 chars), clicks Send
2. Rate limit check (3 per listing, 10 per hour)
3. Blocked users check
4. INSERT into contact_requests
5. Resend → seller's contact_email, Reply-To = buyer's email
6. Show buyer: "Your message was sent. The seller will reply to your email directly."

### Create / edit listing
- Fields: title, description, price (or free toggle), category, condition, photos (up to 5, first = cover), pickup hint
- AUP checkbox required
- Images: client-side compressed, uploaded via Supabase Storage signed URL
- Edit: same form pre-filled. `created_at` never changes.
- Cap: max 10 active listings per user

### Seller profile (public, SSR)
- URL: `/u/[slug]`
- Name, school, member since, bio, social link, all active listings
- Server-side rendered for Google indexing

### Account page
- Edit: display name, contact email, school, bio, social URL, profile photo
- View/manage active and sold listings
- Sign out

---

## Critical operational decisions

### Listing expiry
Auto-expire at `expires_at` (30 days). Vercel cron daily. Sets `status = 'expired'`, fires Resend renewal email. Renewing resets `expires_at = now() + 30 days`.

### Cold start
Seed 20–30 real listings before launch. Both co-founders post real items. Schedule a "listing day" Week 1.

### Image storage cleanup
Database webhook → Edge Function deletes Storage objects on listing removal. Weekly cron as fallback.

---

## Reference queries

### Browse (school-scoped, cursor-based)
```sql
SELECT l.id, l.title, l.price, l.images[1] AS thumbnail,
       l.category, l.condition, l.created_at,
       u.display_name, u.slug AS user_slug, s.name AS school_name
FROM listings l
JOIN users u ON l.user_id = u.id
JOIN schools s ON u.school_id = s.id
JOIN schools_directory sd ON s.directory_id = sd.id
WHERE u.school_id    = $1
  AND l.status       = 'active'
  AND l.listing_type = 'supply'
  AND l.deleted_at   IS NULL
  AND ($2 IS NULL OR l.category = $2)
  AND ($3 IS NULL OR l.price <= $3)
  AND ($4 IS NULL OR l.created_at < $4)
ORDER BY l.created_at DESC
LIMIT 20;
```

### Full-text search (school-scoped)
```sql
SELECT l.id, l.title, l.price, l.images[1] AS thumbnail, l.category,
       ts_rank(l.search_vector, query) AS rank
FROM listings l
JOIN users u ON l.user_id = u.id,
     plainto_tsquery('english', $1) query
WHERE l.search_vector  @@ query
  AND u.school_id      = $2
  AND l.status         = 'active'
  AND l.listing_type   = 'supply'
  AND l.deleted_at     IS NULL
ORDER BY rank DESC
LIMIT 20;
```

### Contact rate limit
```sql
SELECT COUNT(*) FROM contact_requests
WHERE listing_id = $1 AND sender_id = $2;
-- reject if >= 3

SELECT COUNT(*) FROM contact_requests
WHERE sender_id = $1 AND sent_at > now() - interval '1 hour';
-- reject if >= 10
```

### Seller profile
```sql
SELECT u.id, u.display_name, u.slug, u.bio,
       u.social_url, u.profile_photo, u.created_at,
       sd.name AS school_name,
       COUNT(l.id) AS active_listing_count,
       json_agg(
         json_build_object(
           'id', l.id, 'title', l.title, 'price', l.price,
           'thumbnail', l.images[1], 'category', l.category,
           'created_at', l.created_at
         ) ORDER BY l.created_at DESC
       ) FILTER (WHERE l.id IS NOT NULL) AS listings
FROM users u
JOIN schools s ON u.school_id = s.id
JOIN schools_directory sd ON s.directory_id = sd.id
LEFT JOIN listings l
  ON l.user_id = u.id AND l.status = 'active'
  AND l.listing_type = 'supply' AND l.deleted_at IS NULL
WHERE u.slug       = $1
  AND u.deleted_at IS NULL
  AND u.is_suspended = false
GROUP BY u.id, sd.name;
```

### Waitlist signups by school (for launch prioritization)
```sql
SELECT sd.name, sd.state, COUNT(w.id) AS signups
FROM waitlist w
JOIN schools_directory sd ON w.school_id = sd.id
GROUP BY sd.id, sd.name, sd.state
ORDER BY signups DESC;
```

---

## File structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── listings/
│   │   ├── [id]/
│   │   │   ├── page.tsx        -- listing detail (SSR)
│   │   │   └── edit/page.tsx   -- edit listing
│   │   └── new/page.tsx        -- create listing
│   ├── u/
│   │   └── [slug]/page.tsx     -- public seller profile (SSR)
│   ├── account/page.tsx        -- private account settings
│   ├── api/
│   │   ├── waitlist/route.ts   -- POST /api/waitlist
│   │   ├── listings/
│   │   │   ├── route.ts        -- POST /api/listings
│   │   │   └── [id]/route.ts   -- PATCH, DELETE
│   │   ├── contact/route.ts    -- POST /api/contact
│   │   └── cron/expire/route.ts
│   ├── layout.tsx
│   └── page.tsx                -- NEXT_PUBLIC_LAUNCHED flag → teaser or browse
├── components/
│   ├── teaser-page.tsx         -- waitlist signup UI
│   ├── school-combobox.tsx     -- searches schools_directory, used on teaser + sign-up
│   ├── listing-card.tsx
│   ├── listing-grid.tsx
│   ├── search-bar.tsx
│   ├── filter-panel.tsx
│   ├── school-switcher.tsx
│   ├── contact-form.tsx
│   └── listing-form.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── resend.ts
│   ├── rate-limit.ts
│   └── validations.ts
├── lib/data/
│   └── schools_directory.csv  -- IPEDS HD2023, filtered to ~2800 rows
├── supabase/
│   ├── migrations/
│   │   ├── 001_schools_directory.sql
│   │   ├── 002_schools.sql
│   │   ├── 003_waitlist.sql
│   │   └── 004_main_schema.sql
│   └── seed.ts                -- seeds schools_directory from CSV + active schools
├── types/
│   └── database.ts            -- generated: supabase gen types typescript
├── info/
│   ├── CLAUDE.md
│   ├── DECISIONS.md
│   ├── BUILDORDER.md
│   └── UniMarket_Technical_Spec.md
├── .env.local                 -- never committed
├── .env.local.example         -- committed, all keys with placeholder values
└── vercel.json                -- cron job config
```

---

## Future phases (post-MVP)

### v2 — trust, engagement, demand posts
- Demand posts (listing_type = 'demand' — schema ready)
- Matching engine (listing_matches table — schema ready)
- In-app real-time chat (schema ready, activate Supabase Realtime)
- User blocking UI (blocked_users table ready)
- Seller ratings and reviews
- Saved / wishlist items

### v3 — AI dealer + monetization
- AI negotiation layer (negotiation_preferences table ready)
  - Only built after v2 shows demand post usage is real
  - AI proposes deal, both parties confirm — AI cannot commit unilaterally
- Payments (Stripe Connect — marketplace escrow)
- Featured listing bumps

### v4 — expansion
- Sublets / housing
- Multi-school merged feed
- Region layer ("Boston Area") aggregating nearby schools
- GPS as enhancement only (show distance if user grants location)
- Mobile app (only if web traction justifies it)

---

## Things Claude must never suggest for this project

### Architecture
- Do not suggest Firebase. Evaluated and rejected.
- Do not suggest MongoDB. Data is relational.
- Do not suggest Docker or Kubernetes.
- Do not suggest Snowflake, Redis, or Elasticsearch at this stage.
- Do not suggest a native mobile app for September launch.
- Do not suggest Resend Audiences for waitlist storage. Waitlist data lives in Postgres.

### Features
- Do not suggest real-time chat for MVP. Schema exists, UI is v2.
- Do not suggest demand posts or matching engine for MVP. These are v2.
- Do not suggest AI dealer for MVP or v2. It is v3, contingent on v2 validation.
- Do not suggest payments until user traction is proven.
- Do not suggest social login (Google/Apple) for MVP.
- Do not suggest ratings/reviews, saved items, or push notifications for MVP.

### Auth & access
- Do not gate browsing behind auth.
- Do not add sign-up form fields beyond: email, display name, school, optional photo.

### Location
- Do not suggest GPS-based proximity or PostGIS for MVP, v2, or v3.
- Do not suggest ZIP code scoping at any phase.
- Do not require location permission to browse or use the app.

### Schema
- Do not collapse schools_directory and schools into one table.
- Do not store school as a free-text string anywhere.
- Do not use offset-based pagination. Use cursor-based.
- Do not use hard deletes on user-facing data.
- Do not allow free-text category. Category is a CHECK constraint enum.
- Do not expose raw UUIDs in public URLs. Use users.slug.
- Do not make negotiation_preferences readable by the client. Service role only.

---

## Context on the founders

The technical co-founder has shipped: GrabBeforeGrad (co-founded, 40K views), CognizenX (AI app, 1K+ interactions), DeFind (1st prize TigerHacks), SAP search portal at Parker Hannifin, BCforward data pipeline. Comfortable with full-stack Next.js, Supabase, and shipping fast under deadline.

The business co-founder is a Northeastern International Business student focused on marketing and partnerships. She reviews all work via Vercel preview URLs — never ask her to run a local dev environment or CLI command.
