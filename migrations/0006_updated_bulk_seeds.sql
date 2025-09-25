-- 0020_seed_3500_ncic.sql
-- Wipe existing CASE data, then seed 3,500 NCIC-style records across all file types.
-- Idempotent via your prestart runner: it will only APPLY once.
-- NOTE: This intentionally does NOT touch "users".

BEGIN;

-- 0) Wipe existing cases (leave users untouched)
--    Truncate in child->parent order to reset sequences and avoid FK issues.
TRUNCATE TABLE descriptors RESTART IDENTITY;
TRUNCATE TABLE records RESTART IDENTITY CASCADE;
-- Remove any audit logs tied to records
DELETE FROM audit_log WHERE record_id IS NOT NULL;

-- 1) Parameters / helpers
WITH
params AS (
  SELECT
    ARRAY[
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
      'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
      'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
      'TX','UT','VT','VA','WA','WV','WI','WY'
    ]                         AS states,
    ARRAY['John','Jane','Alex','Maria','Chris','Taylor','Jordan','Casey'] AS fnames,
    ARRAY['DOE','SMITH','JOHNSON','BROWN','DAVIS','MILLER','WILSON','MOORE'] AS lnames,
    ARRAY['FORD','CHEV','TOYOTA','HONDA','NISSAN','BMW','AUDI','KIA','HYUNDAI','TESLA'] AS makes,
    ARRAY['CROWN','REGAL','SENTINEL','PIONEER','FREEDOM','UNITY'] AS issuers,
    ARRAY['USA','CAN','MEX','GBR','FRA','DEU','ESP','ITA','JPN','AUS'] AS countries
),
series AS (
  SELECT gs AS i FROM generate_series(1, 3500) AS gs
),
src AS (
  SELECT
    i,
    -- basic picks
    (SELECT states[1 + (i % array_length(states,1))]   FROM params) AS st,
    (SELECT fnames[1 + (i % array_length(fnames,1))]   FROM params) AS fname,
    (SELECT lnames[1 + (i % array_length(lnames,1))]   FROM params) AS lname,
    (SELECT makes[1 + (i % array_length(makes,1))]     FROM params) AS make,
    (SELECT issuers[1 + (i % array_length(issuers,1))] FROM params) AS issuer,
    (SELECT countries[1 + (i % array_length(countries,1))] FROM params) AS country
  FROM series
),
-- 2) Insert records for all file types (16-way distribution)
ins AS (
  INSERT INTO records (
    file_type,
    payload,
    originating_agency,
    originating_case_number,
    ncic_number,
    status,
    created_at,
    updated_at,
    tags
  )
  SELECT
    -- 16 file types by modulo
    CASE (i % 16)
      WHEN 0  THEN 'WANTED_PERSON'
      WHEN 1  THEN 'FOREIGN_FUGITIVE'
      WHEN 2  THEN 'MISSING_PERSON'
      WHEN 3  THEN 'UNIDENTIFIED_PERSON'
      WHEN 4  THEN 'STOLEN_VEHICLE'
      WHEN 5  THEN 'STOLEN_LICENSE_PLATE'
      WHEN 6  THEN 'STOLEN_BOAT'
      WHEN 7  THEN 'STOLEN_GUN'
      WHEN 8  THEN 'STOLEN_ARTICLE'
      WHEN 9  THEN 'SECURITY'
      WHEN 10 THEN 'USSS_PROTECTIVE'
      WHEN 11 THEN 'VIOLENT_CRIMINAL_GANG_MEMBER'
      WHEN 12 THEN 'TERRORIST_MEMBER'
      WHEN 13 THEN 'BATF_VIOLENT_FELON'
      WHEN 14 THEN 'WITSEC_CHARGED'
      ELSE          'INTERSTATE_ID_INDEX'
    END::record_type                                                 AS file_type,

    -- Build realistic payloads using lower-case keys to match app conventions
    CASE (i % 16)
      -- 0) WANTED_PERSON: NAME, DOB, Warrant, Driver, SSN, optional plate/VIN
      WHEN 0 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1970-01-01' + (i % 20000), 'YYYY-MM-DD'),
        'warrant_number', 'WAR-' || to_char(i,'FM000000'),
        'drivers_number', st || '-' || to_char(i,'FM0000000'),
        'ssn',   to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char(i%9999,'FM0000'),
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26)),
        'vin',   'VIN' || upper(substr(md5((i*17)::text),1,14))
      )

      -- 1) FOREIGN_FUGITIVE: NAME, DOB, country, warrant
      WHEN 1 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1960-01-01' + (i % 22000), 'YYYY-MM-DD'),
        'warrant_number', 'INTL-' || to_char(i,'FM000000'),
        'issuer', country
      )

      -- 2) MISSING_PERSON: NAME, DOB
      WHEN 2 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1990-01-01' + (i % 12000), 'YYYY-MM-DD')
      )

      -- 3) UNIDENTIFIED_PERSON: placeholder name, possible DOB missing
      WHEN 3 THEN jsonb_build_object(
        'name',  'DOE, UNKNOWN',
        'dob',   CASE WHEN (i % 4)=0 THEN NULL ELSE to_char(date '1980-01-01' + (i % 15000), 'YYYY-MM-DD') END
      )

      -- 4) STOLEN_VEHICLE: VIN, PLATE, MAKE/MODEL
      WHEN 4 THEN jsonb_build_object(
        'vin',   'VIN' || upper(substr(md5((i*13)::text),1,14)),
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26)),
        'make',  make,
        'model', 'MODEL-' || ((i % 80) + 1)
      )

      -- 5) STOLEN_LICENSE_PLATE: PLATE
      WHEN 5 THEN jsonb_build_object(
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26))
      )

      -- 6) STOLEN_BOAT: HULL_NUMBER, REGISTRATION
      WHEN 6 THEN jsonb_build_object(
        'hull_number', 'HIN' || upper(substr(md5((i*7)::text),1,9)),
        'registration', st || '-' || to_char(i,'FM000000')
      )

      -- 7) STOLEN_GUN: SERIAL, MAKE, MODEL
      WHEN 7 THEN jsonb_build_object(
        'serial', 'G' || upper(substr(md5((i*19)::text),1,10)),
        'make',   'ACME',
        'model',  'MK-' || ((i % 50) + 1)
      )

      -- 8) STOLEN_ARTICLE: OAN and SERIAL (owner applied / manufacturer)
      WHEN 8 THEN jsonb_build_object(
        'oan',    'OAN-' || to_char(i,'FM000000'),
        'serial', 'A' || upper(substr(md5((i*11)::text),1,8))
      )

      -- 9) SECURITY (securities file): SERIAL, ISSUER, OWNER_SSN
      WHEN 9 THEN jsonb_build_object(
        'serial', 'SEC-' || upper(substr(md5((i*23)::text),1,12)),
        'issuer', issuer,
        'owner_ssn', to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char((i*3)%9999,'FM0000')
      )

      -- 10) USSS_PROTECTIVE: NAME, DOB
      WHEN 10 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1950-01-01' + (i % 26000), 'YYYY-MM-DD')
      )

      -- 11) VIOLENT_CRIMINAL_GANG_MEMBER: NAME, DOB
      WHEN 11 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1975-01-01' + (i % 18000), 'YYYY-MM-DD')
      )

      -- 12) TERRORIST_MEMBER: NAME, DOB
      WHEN 12 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1965-01-01' + (i % 22000), 'YYYY-MM-DD')
      )

      -- 13) BATF_VIOLENT_FELON: NAME, DOB, FBI_NUMBER
      WHEN 13 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1970-01-01' + (i % 20000), 'YYYY-MM-DD'),
        'fbi_number', 'FBI' || to_char((i*13)%9999999,'FM0000000')
      )

      -- 14) WITSEC_CHARGED: NAME, DOB
      WHEN 14 THEN jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1978-01-01' + (i % 17000), 'YYYY-MM-DD')
      )

      -- 15) INTERSTATE_ID_INDEX: NAME, DOB, FBI_NUMBER, SSN, DRIVERS_NUMBER
      ELSE jsonb_build_object(
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1972-01-01' + (i % 19000), 'YYYY-MM-DD'),
        'fbi_number', 'FBI' || to_char((i*17)%9999999,'FM0000000'),
        'ssn',   to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char((i*7)%9999,'FM0000'),
        'drivers_number', st || '-' || to_char((i*5)%10000000,'FM0000000')
      )
    END                                                       AS payload,

    -- Agency / case id / ncic number
    (st || '-PD')                                            AS originating_agency,
    ('CASE-' || to_char(i,'FM000000'))                       AS originating_case_number,
    ('NCIC-' || to_char(i,'FM000000'))                       AS ncic_number,

    'ACTIVE'                                                 AS status,
    now() - ((i % 540)) * interval '1 day'                   AS created_at,
    now()                                                    AS updated_at,
    ARRAY['seed','ncic']::text[]                             AS tags
  FROM src
  RETURNING id, payload, originating_case_number
)

-- 3) Insert descriptors for all standard keys present in payload
INSERT INTO descriptors (record_id, key, value)
SELECT
  id,
  d.key,
  d.val
FROM ins
CROSS JOIN LATERAL (
  VALUES
    ('NAME',                 payload->>'name'),
    ('DOB',                  payload->>'dob'),
    ('VIN',                  payload->>'vin'),
    ('PLATE',                payload->>'plate'),
    ('SERIAL',               payload->>'serial'),
    ('HULL_NUMBER',          payload->>'hull_number'),
    ('REGISTRATION',         payload->>'registration'),
    ('OAN',                  payload->>'oan'),
    ('ISSUER',               payload->>'issuer'),
    ('OWNER_SSN',            payload->>'owner_ssn'),
    ('FBI_NUMBER',           payload->>'fbi_number'),
    ('SSN',                  payload->>'ssn'),
    ('DRIVERS_NUMBER',       payload->>'drivers_number'),
    ('WARRANT_NUMBER',       payload->>'warrant_number'),
    ('ORIGINATING_CASE_NUMBER', originating_case_number)
) AS d(key, val)
WHERE d.val IS NOT NULL AND d.val <> '';

COMMIT;
