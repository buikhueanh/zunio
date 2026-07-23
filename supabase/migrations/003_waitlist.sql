-- Teaser page signups. school_id references the full directory (any school can join),
-- not the curated schools table.
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
