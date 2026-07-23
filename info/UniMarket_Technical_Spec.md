# UniMarket — Technical Specification
### Version 1.0 · June 2026

---

## Project overview

UniMarket is a campus-scoped student marketplace. The technical problem is straightforward: a CRUD application with school-based multi-tenancy, full-text search, image storage, email-based messaging, and row-level security. The complexity is in the design decisions — trust model, location model, auth flow — which are all resolved before any code is written.

This document covers: architecture, stack rationale, database schema, API design, security model, user flows implemented in code, and operational concerns. A new engineer should be able to read this and start building without asking questions.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                        │
│              Next.js 14 App Router (React 18)               │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
          ┌─────────────▼──────────────┐
          │     Vercel Edge Network     │
          │   (CDN + Serverless Fns)    │
          └──────┬──────────┬──────────┘
                 │          │
    ┌────────────▼───┐  ┌───▼────────────────────┐
    │  Supabase      │  │  Resend                │
    │  ─────────     │  │  ──────                │
    │  Postgres DB   │  │  Transactional email   │
    │  Auth (JWT)    │  │  Contact relay         │
    │  Storage (S3)  │  │  Listing expiry notifs │
    │  Realtime WS   │  └────────────────────────┘
    └────────────────┘
```

Everything runs on two vendors: Vercel and Supabase. No custom servers. No Docker. No Kubernetes. Both have generous free tiers that cover the entire MVP phase. When we outgrow Supabase's hosted Postgres, we point `DATABASE_URL` at Amazon RDS — zero application code changes because Supabase is vanilla PostgreSQL.

---

## Tech stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Database | PostgreSQL via Supabase | 15.x |
| Auth | Supabase Auth | — |
| Storage | Supabase Storage | — |
| Realtime (v2) | Supabase Realtime | — |
| Hosting | Vercel | — |
| Email | Resend | — |
| Image compression | browser-image-compression | npm |
| Profanity filter | bad-words | npm |

**Why Next.js App Router specifically:** Server components allow data fetching at the component level without client-side waterfalls. Public pages (browse, listing detail, seller profile) are server-rendered and indexable by Google — free SEO. API routes handle all mutations. One codebase covers web, mobile-web, and can become a PWA.

**Why TypeScript:** Supabase CLI generates types directly from the database schema (`supabase gen types typescript`). Every query result is typed. Null safety is enforced at compile time, not discovered at runtime in production.

**Why Tailwind over CSS modules or styled-components:** Velocity. No context switching between files. Consistent spacing/color system. Bundle size is purged to only used classes.

---

## Repository structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   └── sign-up/
│   │       └── page.tsx
│   ├── listings/
│   │   ├── [id]/
│   │   │   ├── page.tsx          ← listing detail (SSR)
│   │   │   └── edit/
│   │   │       └── page.tsx      ← edit listing (auth required)
│   │   └── new/
│   │       └── page.tsx          ← create listing (auth required)
│   ├── u/
│   │   └── [slug]/
│   │       └── page.tsx          ← public seller profile (SSR)
│   ├── account/
│   │   └── page.tsx              ← private account settings
│   ├── api/
│   │   ├── listings/
│   │   │   ├── route.ts          ← POST /api/listings (create)
│   │   │   └── [id]/
│   │   │       └── route.ts      ← PATCH, DELETE /api/listings/[id]
│   │   ├── contact/
│   │   │   └── route.ts          ← POST /api/contact (email relay)
│   │   └── cron/
│   │       └── expire/
│   │           └── route.ts      ← GET /api/cron/expire (Vercel cron)
│   ├── layout.tsx                ← root layout, auth provider
│   └── page.tsx                  ← browse/home (SSR)
│
├── components/
│   ├── listing-card.tsx          ← single listing in grid
│   ├── listing-grid.tsx          ← responsive grid of cards
│   ├── listing-form.tsx          ← shared create/edit form
│   ├── search-bar.tsx            ← controlled input, triggers query
│   ├── filter-panel.tsx          ← category, price, condition filters
│   ├── school-switcher.tsx       ← searchable dropdown, localStorage
│   └── contact-form.tsx          ← message seller form
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             ← createBrowserClient()
│   │   └── server.ts             ← createServerClient() for RSC/API
│   ├── resend.ts                 ← sendContactEmail(), sendExpiryEmail()
│   ├── schools.ts                ← hardcoded school list + seed data
│   ├── rate-limit.ts             ← checkContactRateLimit()
│   └── validations.ts            ← zod schemas for all inputs
│
├── types/
│   └── database.ts               ← generated: supabase gen types typescript
│
├── public/
│   └── ...
│
├── CLAUDE.md                     ← project context for AI assistance
├── .env.local                    ← never committed
└── vercel.json                   ← cron job config
```

---

## Database schema

Full canonical schema. Do not deviate without updating this document.

### Schools directory table

Full IPEDS dataset. ~2,800 rows (4-year public and private non-profit US institutions). Used for autocomplete on the teaser page school picker and the main app sign-up form. Source: `lib/data/schools_directory.csv` (IPEDS HD2023.csv filtered to `ICLEVEL=1, CONTROL IN (1,2)`).

```sql
CREATE TABLE schools_directory (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,        -- "Northeastern University"
  campus   text,                 -- "Boston" or NULL
  city     text,
  state    text,
  ipeds_id text UNIQUE,          -- official IPEDS unit ID
  domain   text                  -- "northeastern.edu" where known
);
```

### Schools table (active/launched campuses only)

Small, manually curated. This is what feed scoping uses. Users and listings FK to this table — not to `schools_directory`. Adding a new active school = add a row pointing at the right `schools_directory` entry, seed listings, flip `active = true`.

```sql
CREATE TABLE schools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid REFERENCES schools_directory(id),
  slug         text NOT NULL UNIQUE,
  active       boolean DEFAULT true,
  launched_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
```

**Who references what:**
- `waitlist.school_id` → `schools_directory.id` (any school can sign up for waitlist)
- `users.school_id` → `schools.id` (only active/launched schools)
- `listings` scoped via `users.school_id` → `schools.id`

Multi-campus handling: "Northeastern – Boston" and "Northeastern – Seattle" are separate rows in both tables with `campus` populated. The `name` field reflects this: "Northeastern University – Boston."

### Waitlist table

Teaser page signups. `school_id` references `schools_directory` (not `schools`) — anyone can join the waitlist regardless of whether their campus is launched yet. `school_id` is nullable for users whose school isn't in the directory.

```sql
CREATE TABLE waitlist (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL UNIQUE,
  school_id       uuid        REFERENCES schools_directory(id), -- NULL if school not listed
  school_name_raw text,       -- populated when school_id IS NULL
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON waitlist (school_id) WHERE school_id IS NOT NULL;

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can join waitlist"
  ON waitlist FOR INSERT WITH CHECK (true);
-- No SELECT policy — reads only via service role key in API routes
```

**Duplicate handling:** Unique constraint on `email`. Duplicate submission (error code 23505) returns success silently — never tell the user "already registered."

**Launch query** (school-specific emails):
```sql
SELECT sd.name, sd.state, COUNT(w.id) AS signups
FROM waitlist w
JOIN schools_directory sd ON w.school_id = sd.id
GROUP BY sd.id, sd.name, sd.state
ORDER BY signups DESC;
```

### Users table

```sql
CREATE TABLE users (
  id                 uuid        PRIMARY KEY REFERENCES auth.users,
  display_name       text        NOT NULL
                                 CHECK (char_length(display_name) BETWEEN 2 AND 40),
  slug               text        NOT NULL UNIQUE, -- "alex-k-7f2a"
  school_id          uuid        NOT NULL REFERENCES schools(id),
  contact_email      text,       -- preferred contact, defaults to auth email
  is_seller_verified boolean     DEFAULT false,
  bio                text        CHECK (char_length(bio) <= 300),
  social_url         text,       -- validated at API layer (approved domains only)
  profile_photo      text,       -- Supabase Storage URL
  is_suspended       boolean     DEFAULT false,
  deleted_at         timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
```

Key decisions documented here:

`school_id` is a foreign key — never a free-text string. One typo in a free-text school field creates a ghost school with broken feed scoping. The dropdown on sign-up maps to `school_id`.

`slug` is generated at insert: `slugify(display_name) + '-' + randomHex(4)`. Example: "Alex Kim" → `alex-kim-7f2a`. Used in public URLs (`/u/alex-kim-7f2a`). Not user-changeable at MVP. Not UUID-based — UUIDs are not shareable.

`contact_email` defaults to auth email at sign-up. User can change it to a Gmail or personal address. This solves the problem of students who never check their `.edu` inbox — contact messages go where they'll actually be seen.

`is_seller_verified` is set to `true` when `.edu` email confirmation is clicked. This decouples auth email from selling eligibility. A user can sign up with a personal email, browse freely, and add a `.edu` later to unlock posting.

`deleted_at` is a soft delete — never hard delete user rows on account closure. Set `deleted_at = now()` and all their listings to `status = 'removed'`. Hard delete after 90 days via cron.

### Listings table

```sql
CREATE TABLE listings (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES users(id),
  title         text         NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description   text         NOT NULL CHECK (char_length(description) <= 2000),
  price         numeric(10,2) CHECK (price IS NULL OR price > 0),
  category      text         NOT NULL CHECK (category IN (
                               'electronics','furniture','clothing',
                               'textbooks','appliances','bikes','free','other'
                             )),
  condition     text         CHECK (condition IN (
                               'new','like_new','used','for_parts'
                             )),
  images        text[],      -- Storage URLs; images[1] = thumbnail
  pickup_hint   text         CHECK (char_length(pickup_hint) <= 100),
  status        text         DEFAULT 'active' CHECK (status IN (
                               'active','sold','expired','removed'
                             )),
  search_vector tsvector     GENERATED ALWAYS AS (
                               to_tsvector('english',
                                 title || ' ' || coalesce(description,''))
                             ) STORED,
  deleted_at    timestamptz,
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now(),
  expires_at    timestamptz  DEFAULT now() + interval '30 days'
);

CREATE INDEX listings_search_idx  ON listings USING GIN(search_vector);
CREATE INDEX listings_status_idx  ON listings (status, created_at DESC)
             WHERE deleted_at IS NULL;
CREATE INDEX listings_user_idx    ON listings (user_id)
             WHERE deleted_at IS NULL;
```

Key decisions:

`price = NULL` means free. `price = 0` is invalid — the CHECK constraint rejects it. Use NULL for free items consistently.

`category` is a CHECK constraint enum, not free text. This is non-negotiable — free text categories break filtering immediately.

`images[1]` (Postgres 1-indexed) is the thumbnail everywhere. First uploaded = cover. The UI makes this clear: "Your first photo will be the cover image." No drag-to-reorder at MVP.

`status` and `deleted_at` are orthogonal. `status = 'sold'` means the seller marked it sold. `deleted_at IS NOT NULL` means a moderator removed it. A sold listing can also be moderation-removed. All public queries filter both.

`search_vector` is a generated column — automatically updated whenever `title` or `description` changes. No application-layer sync needed.

`expires_at` defaults to 30 days from creation. A Vercel cron job runs daily to set `status = 'expired'` on overdue listings and fire renewal emails via Resend.

Editing a listing does NOT change `created_at` — no feed position bump on edit. Only `updated_at` changes. The UI shows an "Edited" badge when `updated_at > created_at + interval '1 hour'`.

### Contact requests table

```sql
CREATE TABLE contact_requests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid        NOT NULL REFERENCES listings(id),
  sender_id  uuid        NOT NULL REFERENCES users(id),
  message    text        NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  sent_at    timestamptz DEFAULT now()
);

CREATE INDEX contact_rate_idx ON contact_requests (listing_id, sender_id);
CREATE INDEX contact_hour_idx ON contact_requests (sender_id, sent_at);
```

This table is a log. The actual conversation moves to email inboxes. Rows are retained for 90 days after an account is deleted.

### Blocked users table

```sql
CREATE TABLE blocked_users (
  blocker_id uuid NOT NULL REFERENCES users(id),
  blocked_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

The table is built now, no UI at MVP. The contact API route and browse queries check this table so blocking works at the data layer before the UI is built.

### Chat tables (v2 — schema present, not activated)

```sql
CREATE TABLE conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid        REFERENCES listings(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id uuid REFERENCES conversations(id),
  user_id         uuid REFERENCES users(id),
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id),
  sender_id       uuid        NOT NULL REFERENCES users(id),
  content         text        NOT NULL,
  created_at      timestamptz DEFAULT now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);

CREATE INDEX messages_convo_idx    ON messages (conversation_id, created_at DESC);
CREATE INDEX participants_user_idx ON conversation_participants (user_id);
```

These tables exist in the database from day one. Activating in-app chat in v2 requires building the UI and Supabase Realtime subscription — no schema migration.

### Triggers

```sql
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

### Row Level Security policies

```sql
-- Listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active listings"
  ON listings FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "owners update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owners delete own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read profiles"
  ON users FOR SELECT
  USING (deleted_at IS NULL AND is_suspended = false);

CREATE POLICY "owners update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Contact requests
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "senders read own requests"
  ON contact_requests FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "authenticated users insert"
  ON contact_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

RLS is enforced at the database level — not application code. Even if an API route has a bug, the database will reject unauthorized writes. This is the key security advantage over application-layer ownership checks, which must be manually repeated in every route handler.

---

## Auth flow

**Stack:** Supabase Auth with email/password. No OAuth at MVP.

**Sign-up flow:**

1. User submits form: email, display name, school (dropdown), optional photo
2. API validates: display name length (2–40 chars), profanity check via `bad-words`, school exists in schools table
3. Supabase Auth creates `auth.users` record, sends verification email
4. API route creates `users` record with `is_seller_verified = false`, generated slug, `contact_email = auth_email`, `school_id` from form
5. User is redirected to browse page with a verification banner

**Verification states:**

- Unverified: can browse, cannot post. Banner: "Verify your email to post listings." Clicking Post → "Check your email" page with resend button.
- Verified: full access.
- Unverified for 7 days: auto-deleted by Supabase Auth setting.

**Seller verification (`.edu` email):**

`is_seller_verified` is set to `true` when `.edu` email verification completes. A user who signed up with a personal email can add a `.edu` as a secondary email later. Supabase Auth supports multiple providers per user. This is handled in account settings. The `schools.domain` field (e.g. `northeastern.edu`) is used to validate that the secondary email matches the user's school.

**Session handling:**

Supabase uses JWTs with a 1-hour expiry and refresh tokens. The server Supabase client (`lib/supabase/server.ts`) reads cookies on every request — no separate session middleware needed. All server components and API routes use the server client. The browser client (`lib/supabase/client.ts`) is used only in client components that need real-time or auth state.

---

## API routes

All mutations go through Next.js API routes (`app/api/`). Server components fetch read-only data directly from Supabase. No REST API abstraction layer — direct Supabase queries.

### POST /api/listings

Creates a new listing. Auth required. `is_seller_verified` must be `true`.

```
Request body:
  title        string  (3–100 chars)
  description  string  (≤ 2000 chars)
  price        number | null
  category     enum
  condition    enum
  images       string[]  (Storage URLs, already uploaded)
  pickup_hint  string | null

Validations (all via Zod schema):
  - title, description, category: required
  - price > 0 or null
  - category must be valid enum value
  - max 10 active listings per user (COUNT check before insert)
  - AUP checkbox must be true in request

Response:
  201  { id: uuid }
  400  { error: string }  validation failure
  401  unauthenticated
  403  is_seller_verified = false
  429  listing cap reached
```

### PATCH /api/listings/[id]

Edits an existing listing. Auth required. User must own the listing (RLS enforces this at DB level too).

```
Request body: same fields as POST, all optional
Note: created_at is never changed. updated_at is updated by trigger.

Response:
  200  { id: uuid }
  403  not owner
  404  listing not found
```

### DELETE /api/listings/[id]

Soft delete: sets `deleted_at = now()`, triggers Storage cleanup via database webhook.

### POST /api/contact

Email relay. Auth required.

```
Request body:
  listing_id   uuid
  message      string (10–1000 chars)

Pre-insert checks (in order):
  1. Listing exists and is active
  2. Sender is not blocked by listing owner (blocked_users check)
  3. Rate limit: max 3 messages per buyer per listing
  4. Rate limit: max 10 messages per buyer per hour (all listings)

On pass:
  - INSERT into contact_requests
  - Resend: send email to seller's contact_email
    Subject: "Someone's interested in: [listing title]"
    Reply-To: buyer's auth email
    Body: buyer's message + link to listing

Response:
  200  { sent: true }
  400  validation error
  401  unauthenticated
  403  blocked
  404  listing not found / inactive
  429  rate limit exceeded
```

### GET /api/cron/expire

Runs on Vercel cron, daily at midnight ET. Protected by a `CRON_SECRET` header.

```
Logic:
  1. SELECT listings WHERE status = 'active' AND expires_at < now()
  2. UPDATE those listings SET status = 'expired'
  3. Send expiry email to each seller via Resend

Response: 200 { expired: number }
```

---

## Key queries

### Browse feed (school-scoped, cursor-based pagination)

```sql
SELECT
  l.id,
  l.title,
  l.price,
  l.images[1]   AS thumbnail,
  l.category,
  l.condition,
  l.created_at,
  u.display_name,
  u.slug         AS user_slug,
  s.name         AS school_name
FROM listings l
JOIN users   u ON l.user_id    = u.id
JOIN schools s ON u.school_id  = s.id
WHERE u.school_id  = $1                           -- school switcher value
  AND l.status     = 'active'
  AND l.deleted_at IS NULL
  AND ($2 IS NULL OR l.category = $2)             -- category filter
  AND ($3 IS NULL OR l.price    <= $3)            -- max price filter
  AND ($4 IS NULL OR l.created_at < $4)           -- cursor (pagination)
ORDER BY l.created_at DESC
LIMIT 20;
```

Cursor-based, not offset-based. `$4` is the `created_at` of the last item from the previous page. This prevents duplicate or skipped items when new listings are inserted between page loads — a real problem with offset pagination on active feeds.

### Full-text search (school-scoped)

```sql
SELECT
  l.id,
  l.title,
  l.price,
  l.images[1]  AS thumbnail,
  l.category,
  ts_rank(l.search_vector, query) AS rank
FROM listings l
JOIN users u ON l.user_id = u.id,
     plainto_tsquery('english', $1) query
WHERE l.search_vector @@ query
  AND u.school_id  = $2
  AND l.status     = 'active'
  AND l.deleted_at IS NULL
ORDER BY rank DESC
LIMIT 20;
```

Search is always school-scoped. Cross-school search is a v2 feature. `plainto_tsquery` handles natural language input — "macbook pro charger" works correctly without requiring exact phrase matching.

### Seller profile (single query)

```sql
SELECT
  u.id,
  u.display_name,
  u.slug,
  u.bio,
  u.social_url,
  u.profile_photo,
  u.created_at,
  s.name         AS school_name,
  COUNT(l.id)    AS active_listing_count,
  json_agg(
    json_build_object(
      'id',         l.id,
      'title',      l.title,
      'price',      l.price,
      'thumbnail',  l.images[1],
      'category',   l.category,
      'created_at', l.created_at
    ) ORDER BY l.created_at DESC
  ) FILTER (WHERE l.id IS NOT NULL) AS listings
FROM users   u
JOIN schools s ON u.school_id = s.id
LEFT JOIN listings l
  ON  l.user_id    = u.id
  AND l.status     = 'active'
  AND l.deleted_at IS NULL
WHERE u.slug       = $1
  AND u.deleted_at IS NULL
  AND u.is_suspended = false
GROUP BY u.id, s.name;
```

One network round-trip returns everything needed for the profile page. `json_agg` with `FILTER` handles the case where a user has no listings — returns `null` instead of a JSON null array.

---

## Location / school model

**Architecture decision: school as a foreign key, feed scoped by `school_id` on the `users` table.**

No GPS. No ZIP codes. No PostGIS. The browse query is `WHERE u.school_id = $1` — a single indexed equality check.

**Why not GPS:** ~30% of web users deny location permission. Sellers post from home, not campus. GPS coordinates don't represent "my campus community." PostGIS extension + spatial index + radius math + permission handling = 2–3 days of extra work with no user benefit over the school model.

**Why not ZIP codes:** ZIP boundaries don't align with campuses. Users don't think in ZIP codes.

**School switcher state machine:**

```
New visitor (no session, no localStorage)
  → Show school picker on browse page
  → On selection: store in localStorage as 'selected_school_id'
  → Feed immediately loads for that school

Logged-in user
  → Default feed = users.school_id from profile
  → School switcher changes session scope only (not users.school_id)
  → Session scope stored in React state or URL param (?school=northeastern)

User changes home school (account settings)
  → UPDATE users SET school_id = $new_school_id
  → Existing listings are unaffected (already posted)
  → New listings will appear in new school's feed
```

**Default for logged-out visitors with no localStorage:** Northeastern (most seeded listings at launch). Show inline prompt: "Not your school? Change it →" — no modal.

---

## Image handling

**Upload flow:**

1. User selects photos on listing form
2. Client-side: `browser-image-compression` reduces each image to ≤ 1MB before upload
3. Client requests a signed upload URL from Supabase Storage via API route
4. Browser uploads directly to Supabase Storage using the signed URL (no server proxy)
5. Storage URLs are saved to the `listings.images` array on listing creation
6. `images[1]` is always the thumbnail — first uploaded = cover photo

**Storage bucket config:**
- Bucket: `listing-images`
- Public read access
- Max file size: 5MB (before compression)
- Accepted types: `image/jpeg`, `image/png`, `image/webp`

**Cleanup on listing removal:**

A Supabase Database Webhook fires on `listings` table UPDATE when `deleted_at` is set or `status = 'removed'`. The webhook calls a Supabase Edge Function that iterates the `images` array and deletes each Storage object. A weekly cron runs as a fallback to catch any orphaned files.

---

## Email (Resend)

Two email types at MVP:

**Contact email** (buyer → seller):
```
To:       seller.contact_email
From:     noreply@unimarket.app
Reply-To: buyer.auth_email
Subject:  Someone's interested in: [listing title]
Body:     buyer's message
          ---
          View listing: https://unimarket.app/listings/[id]
          Reply directly to this email to respond to [buyer name].
          Not interested? You can ignore this email.
```

**Expiry email** (platform → seller):
```
To:       seller.contact_email
From:     noreply@unimarket.app
Subject:  Your listing "[title]" has expired
Body:     Your listing expired after 30 days.
          Renew it to keep it visible to buyers.
          [Renew listing →] https://unimarket.app/listings/[id]/renew
```

Resend free tier: 3,000 emails/month, 100/day. Sufficient for MVP. Upgrade when volume demands it.

---

## Input validation

All API inputs are validated with Zod before reaching the database. Schema definitions live in `lib/validations.ts`.

**Field-level constraints enforced at both Zod (API) and Postgres (DB):**

| Field | Constraint |
|---|---|
| `display_name` | 2–40 characters, profanity check |
| `title` | 3–100 characters |
| `description` | ≤ 2000 characters |
| `bio` | ≤ 300 characters |
| `pickup_hint` | ≤ 100 characters |
| `message` | 10–1000 characters |
| `price` | NULL or > 0 |
| `category` | enum: electronics, furniture, clothing, textbooks, appliances, bikes, free, other |
| `condition` | enum: new, like_new, used, for_parts |
| `social_url` | must start with approved domain list |

**Social URL validation** — allowed prefixes:
- `https://instagram.com/`
- `https://linkedin.com/in/`
- `https://twitter.com/`
- `https://x.com/`

Anything else is rejected at the API layer before saving. Rendered with `rel="noopener noreferrer" target="_blank"`.

**Profanity filter:** `bad-words` npm package applied to `display_name` at sign-up and on edit. Not applied to listing descriptions — sellers are verified students, and overzealous filtering on free-text fields causes UX problems.

---

## Rate limiting

Enforced at the API route level via Postgres COUNT queries before any insert. No Redis, no external service needed at MVP.

```typescript
// lib/rate-limit.ts

export async function checkContactRateLimit(
  supabase: SupabaseClient,
  senderId: string,
  listingId: string
): Promise<{ allowed: boolean; reason?: string }> {

  // Check 1: max 3 messages per buyer per listing
  const { count: perListing } = await supabase
    .from('contact_requests')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('sender_id', senderId);

  if (perListing >= 3) {
    return { allowed: false, reason: 'per_listing_limit' };
  }

  // Check 2: max 10 messages per buyer per hour (all listings)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: perHour } = await supabase
    .from('contact_requests')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', senderId)
    .gte('sent_at', oneHourAgo);

  if (perHour >= 10) {
    return { allowed: false, reason: 'hourly_limit' };
  }

  return { allowed: true };
}
```

Both checks run before any insert. Violations return HTTP 429. The indexes on `contact_requests (listing_id, sender_id)` and `(sender_id, sent_at)` make these COUNT queries fast even at volume.

---

## Slug generation

```typescript
// Generated at user creation, stored in users.slug
// Example: "Alex Kim" → "alex-kim-7f2a"

function generateSlug(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // non-alphanumeric → dash
    .replace(/^-|-$/g, '')         // trim leading/trailing dashes
    .slice(0, 20);                 // max 20 chars before suffix

  const suffix = Math.random().toString(16).slice(2, 6); // 4-char hex
  return `${base}-${suffix}`;
}
```

Uniqueness is checked at insert with a retry loop (max 3 attempts). In practice, collisions are extremely rare with a 4-char hex suffix (65,536 possible values per base slug). Not user-changeable at MVP. Not UUID-based — UUIDs are not human-readable or shareable.

---

## Soft delete convention

Every user-facing table has `deleted_at timestamptz`. All public queries add `WHERE deleted_at IS NULL`. This is the only deletion pattern used — no hard deletes on user-generated content at MVP.

`listings` has two orthogonal state mechanisms:
- `status` tracks business state: `active`, `sold`, `expired`, `removed`
- `deleted_at` tracks moderation removal: set by admin SQL query

A sold listing has `status = 'sold'` and `deleted_at = null`. A moderation-removed listing has `status = 'removed'` and `deleted_at = now()`. They are independent — a sold listing can also be moderation-removed.

---

## Moderation (MVP)

No admin UI. Moderation is manual SQL via the Supabase dashboard.

**Report flow:**
1. User clicks "Report listing" on any listing
2. API route sends email to `moderation@unimarket.app` with listing ID, listing URL, reporter's user ID, and optional reason
3. Admin reviews listing in Supabase dashboard
4. Admin action: `UPDATE listings SET status = 'removed', deleted_at = now() WHERE id = '[id]'`
5. Optional: `UPDATE users SET is_suspended = true WHERE id = '[id]'` for repeat offenders

**Acceptable Use Policy:** Required before public launch. A checkbox on listing creation — "I confirm this item follows UniMarket's guidelines [link]" — must be checked before submit. This shifts legal responsibility to the poster.

**Prohibited items (defined in AUP):** weapons, controlled substances, prescription medication, alcohol, adult content, counterfeit goods, stolen property.

---

## Listing expiry system

```
Vercel cron config (vercel.json):
{
  "crons": [{
    "path": "/api/cron/expire",
    "schedule": "0 5 * * *"   ← 00:00 ET = 05:00 UTC
  }]
}

Authorization: header must include
  Authorization: Bearer $CRON_SECRET

Logic:
  1. SELECT id, title, user_id FROM listings
     WHERE status = 'active'
       AND expires_at < now()
       AND deleted_at IS NULL

  2. UPDATE listings SET status = 'expired'
     WHERE id IN (above IDs)

  3. For each expired listing:
     - Fetch seller's contact_email
     - Send expiry email via Resend with renew link

Renew action (seller clicks link in email):
  - PATCH /api/listings/[id]
  - Sets status = 'active', expires_at = now() + interval '30 days'
  - Auth required, ownership checked
```

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never exposed to client

# Resend
RESEND_API_KEY=

# Cron security
CRON_SECRET=                    # random string, checked in /api/cron/expire

# App
NEXT_PUBLIC_APP_URL=            # https://unimarket.app
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — used only in server-side cron and admin operations. Never referenced in client components or exposed to the browser.

---

## Performance considerations

**Server-side rendering:** Browse page, listing detail, and seller profile are all SSR via Next.js App Router server components. Content is rendered on the server and returned as HTML — indexable by Google, fast initial paint, no client-side waterfall.

**Indexes:** Three indexes on `listings` cover the primary access patterns:
- `GIN(search_vector)` — full-text search
- `(status, created_at DESC) WHERE deleted_at IS NULL` — browse feed
- `(user_id) WHERE deleted_at IS NULL` — seller profile listings

**No caching layer at MVP.** Supabase's PgBouncer handles connection pooling. At MVP user volumes, Postgres response times will be well under 100ms without additional caching. Redis becomes relevant when queries under load exceed acceptable thresholds.

**Image optimization:** Next.js `<Image>` component handles automatic resizing and WebP conversion. Combined with client-side pre-compression via `browser-image-compression`, bandwidth and storage costs stay low.

---

## What is intentionally not built at MVP

These are deliberate decisions, not omissions. Do not implement these without revisiting the tradeoffs.

| Feature | Why deferred | Target phase |
|---|---|---|
| In-app real-time chat | 3–4 weeks to build correctly. Email relay covers the use case for early users. Chat schema already in DB ready to activate. | v2 |
| Payments / transactions | Can't validate demand without users first. Stripe Connect adds legal complexity. | v3 |
| Ratings and reviews | Requires transaction history to be meaningful. | v2 |
| GPS proximity | ~30% permission denial rate on web. School model covers the actual need better. | v4 (optional enhancement only) |
| Native mobile app | Two codebases, app store delays. Web PWA covers mobile for launch. | If web traction justifies it |
| Admin UI | Manual Supabase dashboard SQL is sufficient at MVP user volumes. | When volume demands it |
| Social login (OAuth) | OAuth email may not be .edu. Adds complexity without solving the trust problem. | Consider for v2 |
| Cross-school search | Adds query complexity. Single-school search covers MVP needs. | v2 |

---

## Scaling path

This architecture scales to roughly 100,000 users without changes.

**At ~10,000 users:** Monitor slow query log. Add indexes if browse queries exceed 50ms. Consider adding a `school_id` column directly on `listings` (denormalization) to avoid the JOIN on every browse query.

**At ~100,000 users:** Supabase connection pooling (PgBouncer) begins to constrain throughput. Migrate to a dedicated Postgres instance (Amazon RDS, Neon, or Supabase Pro). Connection string change only — zero application code changes.

**At ~1,000,000 users:** Read replicas for browse/search queries. Cache popular school feeds in Redis with a short TTL. Consider Elasticsearch for search if Postgres full-text performance degrades under load.

The stack was chosen specifically to avoid premature scaling work. None of the above is needed before there are real users with real usage patterns to measure.

---

*Technical spec v1.0 — June 2026. Update this document when any architectural decision changes.*
