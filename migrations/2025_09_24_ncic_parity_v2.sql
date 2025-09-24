-- Enable UUID helper (safe if already present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create ENUM type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_type') THEN
    CREATE TYPE record_type AS ENUM (
      'WANTED_PERSON',
      'FOREIGN_FUGITIVE',
      'MISSING_PERSON',
      'UNIDENTIFIED_PERSON',
      'STOLEN_VEHICLE',
      'STOLEN_LICENSE_PLATE',
      'STOLEN_BOAT',
      'STOLEN_GUN',
      'STOLEN_ARTICLE',
      'SECURITY',
      'USSS_PROTECTIVE',
      'VIOLENT_CRIMINAL_GANG_MEMBER',
      'TERRORIST_MEMBER',
      'BATF_VIOLENT_FELON',
      'WITSEC_CHARGED',
      'INTERSTATE_ID_INDEX'
    );
  END IF;
END$$;

-- RECORDS first (parent)
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type record_type NOT NULL,
  payload JSONB NOT NULL,
  originating_agency VARCHAR(128) NOT NULL,
  originating_case_number VARCHAR(64),
  ncic_number VARCHAR(32),
  status VARCHAR(24) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}'
);

-- DESCRIPTORS (child)
CREATE TABLE IF NOT EXISTS descriptors (
  id BIGSERIAL PRIMARY KEY,
  record_id UUID REFERENCES records(id) ON DELETE CASCADE,
  key VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT GENERATED ALWAYS AS (
    regexp_replace(upper(value), '\s+', '', 'g')
  ) STORED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_file_type ON records(file_type);
CREATE INDEX IF NOT EXISTS idx_descriptors_key_val ON descriptors(key, normalized_value);
CREATE INDEX IF NOT EXISTS idx_records_effective_until ON records(effective_until);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_role VARCHAR(64),
  action VARCHAR(32) NOT NULL,
  record_id UUID,
  context JSONB
);

-- Trigger function for 48h Temporary Felony Want auto-expire
CREATE OR REPLACE FUNCTION schedule_tfw_purge() RETURNS trigger AS $$
BEGIN
  IF NEW.file_type = 'WANTED_PERSON' AND (NEW.payload->>'temporary_felony_want')::boolean = true THEN
    NEW.effective_until := now() + interval '48 hours';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Drop & recreate trigger idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tfw_purge') THEN
    DROP TRIGGER trg_tfw_purge ON records;
  END IF;
END$$;

CREATE TRIGGER trg_tfw_purge
BEFORE INSERT ON records
FOR EACH ROW EXECUTE FUNCTION schedule_tfw_purge();
