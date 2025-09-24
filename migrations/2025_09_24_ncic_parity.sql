-- db/migrations/2025_09_24_ncic_parity.sql
'USSS_PROTECTIVE',
'VIOLENT_CRIMINAL_GANG_MEMBER',
'TERRORIST_MEMBER',
'BATF_VIOLENT_FELON',
'WITSEC_CHARGED',
'INTERSTATE_ID_INDEX'
);


CREATE TABLE IF NOT EXISTS records (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
file_type record_type NOT NULL,
payload JSONB NOT NULL,
originating_agency VARCHAR(128) NOT NULL,
originating_case_number VARCHAR(64),
ncic_number VARCHAR(32), -- if applicable
status VARCHAR(24) DEFAULT 'ACTIVE', -- ACTIVE | CLEARED | PURGED
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
effective_until TIMESTAMPTZ, -- retention/purge scheduling
tags TEXT[] DEFAULT '{}'
);


CREATE TABLE IF NOT EXISTS descriptors (
id BIGSERIAL PRIMARY KEY,
record_id UUID REFERENCES records(id) ON DELETE CASCADE,
key VARCHAR(64) NOT NULL, -- e.g., 'VIN', 'PLATE', 'SERIAL', 'NAME', 'DOB', 'FBI_NUMBER', 'SSN'
value TEXT NOT NULL,
normalized_value TEXT GENERATED ALWAYS AS (
regexp_replace(upper(value), '\\s+', '', 'g')
) STORED
);


CREATE INDEX IF NOT EXISTS idx_records_file_type ON records(file_type);
CREATE INDEX IF NOT EXISTS idx_descriptors_key_val ON descriptors(key, normalized_value);
CREATE INDEX IF NOT EXISTS idx_records_effective_until ON records(effective_until);


-- Access / Use constraint support
CREATE TABLE IF NOT EXISTS audit_log (
id BIGSERIAL PRIMARY KEY,
occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
actor_id UUID, -- user id in your auth system
actor_role VARCHAR(64), -- e.g., 'ADMIN', 'ANALYST', 'DISPATCH_TRAINER'
action VARCHAR(32) NOT NULL, -- READ | CREATE | UPDATE | CLEAR | PURGE | SEARCH
record_id UUID,
context JSONB -- details: query, filtered fields, network, etc.
);


-- Helper function: schedule 48‑hour purge for Temporary Felony Want (TFW)
CREATE OR REPLACE FUNCTION schedule_tfw_purge() RETURNS trigger AS $$
BEGIN
IF NEW.file_type = 'WANTED_PERSON' AND (NEW.payload->>'temporary_felony_want')::boolean = true THEN
NEW.effective_until := now() + interval '48 hours';
END IF;
RETURN NEW;
END;$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_tfw_purge
BEFORE INSERT ON records
FOR EACH ROW EXECUTE FUNCTION schedule_tfw_purge();


-- Optional: nightly purge job looks for expired effective_until
-- (Implement with your scheduler / cron container)