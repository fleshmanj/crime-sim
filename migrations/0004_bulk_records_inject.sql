-- 0020_seed_3500_ncic.sql
-- Seed 3,500 NCIC records + descriptors.
-- Safe to run once (your migrator will mark it applied). Do NOT re-run manually
-- unless you intentionally want duplicates.

BEGIN;

WITH series AS (
  SELECT gs AS i FROM generate_series(1, 3500) AS gs
),
new_rows AS (
  INSERT INTO records (
    file_type,
    payload,
    originating_agency,
    originating_case_number,
    ncic_number,
    status,
    created_at
  )
  SELECT
    -- Distribute 5 ways
    CASE (i % 5)
      WHEN 0 THEN 'WANTED_PERSON'
      WHEN 1 THEN 'STOLEN_VEHICLE'
      WHEN 2 THEN 'STOLEN_GUN'
      WHEN 3 THEN 'MISSING_PERSON'
      ELSE 'STOLEN_LICENSE_PLATE'
    END::record_type                                         AS file_type,

    -- Payloads use lower-case keys to match the app’s descriptor builder convention
    CASE (i % 5)
      WHEN 0 THEN  -- WANTED_PERSON
        jsonb_build_object(
          'name',   upper(substr(md5(i::text),1,6)) || ', ' || initcap('John'),
          'dob',    to_char(date '1970-01-01' + (i % 18000), 'YYYY-MM-DD'),
          'plate',  'FL ' || to_char(i, 'FM000') || chr(65 + (i % 26)),
          'vin',    'VIN' || upper(substr(md5((i*17)::text),1,14)),
          'warrant_number', 'WAR-' || to_char(i,'FM00000')
        )
      WHEN 1 THEN  -- STOLEN_VEHICLE
        jsonb_build_object(
          'vin',    'VIN' || upper(substr(md5((i*13)::text),1,14)),
          'plate',  'CA ' || to_char(i, 'FM000') || chr(65 + (i % 26)),
          'make',   'MAKE'  || ((i % 20) + 1),
          'model',  'MODEL' || ((i % 50) + 1)
        )
      WHEN 2 THEN  -- STOLEN_GUN
        jsonb_build_object(
          'serial', 'SER' || upper(substr(md5((i*19)::text),1,10)),
          'make',   'ACME',
          'model',  'MK' || ((i % 50) + 1)
        )
      WHEN 3 THEN  -- MISSING_PERSON
        jsonb_build_object(
          'name',   upper(substr(md5((i+999)::text),1,6)) || ', ' || initcap('Jane'),
          'dob',    to_char(date '1990-01-01' + (i % 10000), 'YYYY-MM-DD')
        )
      ELSE         -- STOLEN_LICENSE_PLATE
        jsonb_build_object(
          'plate',  'TX ' || to_char(i, 'FM000') || chr(65 + (i % 26))
        )
    END                                                    AS payload,

    'SEED-NCIC'                                           AS originating_agency,
    'CASE-' || to_char(i,'FM000000')                      AS originating_case_number,
    'NCIC-' || to_char(i,'FM000000')                      AS ncic_number,
    'ACTIVE'                                              AS status,
    now() - ((i % 365)) * interval '1 day'                AS created_at
  FROM series
  RETURNING id, file_type, payload, originating_case_number, ncic_number
)

-- Insert matching descriptors (DO NOT set normalized_value; DB generates it)
INSERT INTO descriptors (record_id, key, value)
SELECT
  nr.id,
  d.key,
  d.val
FROM new_rows AS nr
CROSS JOIN LATERAL (
  -- WANTED_PERSON + MISSING_PERSON
  SELECT 'NAME'::varchar(64) AS key, nr.payload->>'name' AS val
  WHERE nr.file_type IN ('WANTED_PERSON'::record_type, 'MISSING_PERSON'::record_type)
  UNION ALL
  SELECT 'DOB', nr.payload->>'dob'
  WHERE nr.file_type IN ('WANTED_PERSON'::record_type, 'MISSING_PERSON'::record_type)

  -- WANTED_PERSON + STOLEN_VEHICLE + STOLEN_LICENSE_PLATE
  UNION ALL
  SELECT 'PLATE', nr.payload->>'plate'
  WHERE nr.file_type IN ('WANTED_PERSON'::record_type, 'STOLEN_VEHICLE'::record_type, 'STOLEN_LICENSE_PLATE'::record_type)

  -- WANTED_PERSON + STOLEN_VEHICLE
  UNION ALL
  SELECT 'VIN', nr.payload->>'vin'
  WHERE nr.file_type IN ('WANTED_PERSON'::record_type, 'STOLEN_VEHICLE'::record_type)

  -- STOLEN_GUN (+ optional make/model for vehicles too)
  UNION ALL
  SELECT 'SERIAL', nr.payload->>'serial'
  WHERE nr.file_type = 'STOLEN_GUN'::record_type
  UNION ALL
  SELECT 'MAKE', nr.payload->>'make'
  WHERE nr.file_type IN ('STOLEN_GUN'::record_type, 'STOLEN_VEHICLE'::record_type)
  UNION ALL
  SELECT 'MODEL', nr.payload->>'model'
  WHERE nr.file_type IN ('STOLEN_GUN'::record_type, 'STOLEN_VEHICLE'::record_type)

  -- Common case metadata
  UNION ALL
  SELECT 'ORIGINATING_CASE_NUMBER', nr.originating_case_number
  WHERE nr.originating_case_number IS NOT NULL

  -- Warrant for WANTED_PERSON
  UNION ALL
  SELECT 'WARRANT_NUMBER', nr.payload->>'warrant_number'
  WHERE nr.file_type = 'WANTED_PERSON'::record_type
) AS d
WHERE d.val IS NOT NULL AND d.val <> '';

COMMIT;
