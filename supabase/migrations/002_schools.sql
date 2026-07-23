-- Active/launched campuses only (manually curated, small).
-- users.school_id and listings scoping FK to this table, not schools_directory.
CREATE TABLE schools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid REFERENCES schools_directory(id),
  slug         text NOT NULL UNIQUE,
  active       boolean DEFAULT true,
  launched_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
