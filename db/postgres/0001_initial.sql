CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  csrf text NOT NULL,
  state text NOT NULL,
  expires bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS consent_events (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  version text NOT NULL,
  scopes text NOT NULL,
  created_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS meals (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  day text NOT NULL,
  payload text NOT NULL,
  idempotency_key text NOT NULL,
  UNIQUE (owner, idempotency_key)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_meals_owner_day ON meals (owner, day);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback (
  meal_id text PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  payload text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS groups (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  invite_hash text NOT NULL UNIQUE,
  expires bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  label text NOT NULL,
  payload text NOT NULL,
  encrypted integer NOT NULL DEFAULT 0,
  UNIQUE (group_id, owner)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS recommendations (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  payload text NOT NULL,
  expires bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS selections (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  payload text NOT NULL,
  status text NOT NULL,
  expires bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_selections_owner_status ON selections (owner, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sensitive_profiles (
  owner text PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  payload text NOT NULL
);
