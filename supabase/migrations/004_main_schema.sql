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
