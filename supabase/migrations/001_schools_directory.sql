-- Full IPEDS school directory (seeded from lib/data/schools_directory.csv)
-- Used for autocomplete only. Not FK'd by users/listings — see 002_schools.sql.
CREATE TABLE schools_directory (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,
  campus   text,
  city     text,
  state    text,
  ipeds_id text UNIQUE,
  domain   text
);
