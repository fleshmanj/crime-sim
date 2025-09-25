-- 0007_new_updated_bulk_seeds.sql
-- Wipe existing case data, then seed 3,500 NCIC-style records across all 16 file types.
-- Leaves users alone. Postgres generates normalized_value; we don't touch it.

BEGIN;

-- 0) Wipe CASE tables (keep users)
TRUNCATE TABLE descriptors RESTART IDENTITY;
TRUNCATE TABLE records RESTART IDENTITY CASCADE;
DELETE FROM audit_log WHERE record_id IS NOT NULL;

-- 1) Parameters
WITH params AS (
  SELECT
    ARRAY[
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
      'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
      'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
      'TX','UT','VT','VA','WA','WV','WI','WY'
    ] AS states,
    ARRAY['John','Jane','Alex','Maria','Chris','Taylor','Jordan','Casey','Riley'] AS fnames,  -- 9
    ARRAY['DOE','SMITH','JOHNSON','BROWN','DAVIS','MILLER','WILSON','MOORE','LEE','CLARK','HARRIS'] AS lnames, -- 11
    ARRAY['FORD','CHEV','TOYOTA','HONDA','NISSAN','BMW','AUDI','KIA','HYUNDAI','TESLA'] AS makes,
    ARRAY['CROWN','REGAL','SENTINEL','PIONEER','FREEDOM','UNITY'] AS issuers,
    ARRAY['USA','CAN','MEX','GBR','FRA','DEU','ESP','ITA','JPN','AUS'] AS countries
),
series AS (
  SELECT gs AS i FROM generate_series(1, 3500) AS gs
),
-- 2) Source rows with per-type index (grp) and arrays in scope
src AS (
  SELECT
    s.i,
    (s.i - 1) / 16                           AS grp,     -- grows within each type bucket
    (s.i % 16)                                AS tslot,   -- 0..15 (file type slot)
    p.states[ 1 + (( ((s.i - 1)/16)*7  + (s.i % 16)) % array_length(p.states,1)) ]     AS st,
    p.fnames[ 1 + (( ((s.i - 1)/16)*3  + (s.i % 16)) % array_length(p.fnames,1)) ]     AS fname,
    p.lnames[ 1 + (( ((s.i - 1)/16)*5  + (s.i % 16)) % array_length(p.lnames,1)) ]     AS lname,
    p.makes[  1 + (( ((s.i - 1)/16)*11 + (s.i % 16)) % array_length(p.makes,1)) ]      AS make,
    p.issuers[1 + (((s.i - 1)/16 + (s.i % 16)) % array_length(p.issuers,1)) ]          AS issuer,
    p.countries[1 + (( ((s.i - 1)/16)*13 + (s.i % 16)) % array_length(p.countries,1)) ] AS country
  FROM series s
  CROSS JOIN params p
),
-- 3) Insert records across all 16 file types
ins AS (
  INSERT INTO records (
    file_type, payload, originating_agency, originating_case_number,
    ncic_number, status, created_at, updated_at, tags
  )
  SELECT
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
    END::record_type AS file_type,

    CASE (i % 16)
      WHEN 0 THEN jsonb_build_object( -- WANTED_PERSON
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1970-01-01' + (i % 20000), 'YYYY-MM-DD'),
        'warrant_number', 'WAR-' || to_char(i,'FM000000'),
        'drivers_number', st || '-' || to_char(i,'FM0000000'),
        'ssn',   to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char(i%9999,'FM0000'),
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26)),
        'vin',   'VIN' || upper(substr(md5((i*17)::text),1,14))
      )
      WHEN 1 THEN jsonb_build_object( -- FOREIGN_FUGITIVE
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1960-01-01' + (i % 22000), 'YYYY-MM-DD'),
        'warrant_number', 'INTL-' || to_char(i,'FM000000'),
        'issuer', country
      )
      WHEN 2 THEN jsonb_build_object( -- MISSING_PERSON
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1990-01-01' + (i % 12000), 'YYYY-MM-DD')
      )
      WHEN 3 THEN jsonb_build_object( -- UNIDENTIFIED_PERSON
        'name',  CASE WHEN (i % 5)=0 THEN (lname || ', ' || initcap(fname)) ELSE 'DOE, UNKNOWN' END,
        'dob',   CASE WHEN (i % 4)=0 THEN NULL ELSE to_char(date '1980-01-01' + (i % 15000), 'YYYY-MM-DD') END
      )
      WHEN 4 THEN jsonb_build_object( -- STOLEN_VEHICLE
        'vin',   'VIN' || upper(substr(md5((i*13)::text),1,14)),
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26)),
        'make',  make,
        'model', 'MODEL-' || ((i % 80) + 1)
      )
      WHEN 5 THEN jsonb_build_object( -- STOLEN_LICENSE_PLATE
        'plate', st || ' ' || to_char(i%999,'FM000') || chr(65 + (i % 26))
      )
      WHEN 6 THEN jsonb_build_object( -- STOLEN_BOAT
        'hull_number', 'HIN' || upper(substr(md5((i*7)::text),1,9)),
        'registration', st || '-' || to_char(i,'FM000000')
      )
      WHEN 7 THEN jsonb_build_object( -- STOLEN_GUN
        'serial', 'G' || upper(substr(md5((i*19)::text),1,10)),
        'make',   'ACME',
        'model',  'MK-' || ((i % 50) + 1)
      )
      WHEN 8 THEN jsonb_build_object( -- STOLEN_ARTICLE
        'oan',    'OAN-' || to_char(i,'FM000000'),
        'serial', 'A' || upper(substr(md5((i*11)::text),1,8))
      )
      WHEN 9 THEN jsonb_build_object( -- SECURITY
        'serial', 'SEC-' || upper(substr(md5((i*23)::text),1,12)),
        'issuer', issuer,
        'owner_ssn', to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char((i*3)%9999,'FM0000')
      )
      WHEN 10 THEN jsonb_build_object( -- USSS_PROTECTIVE
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1950-01-01' + (i % 26000), 'YYYY-MM-DD')
      )
      WHEN 11 THEN jsonb_build_object( -- VIOLENT_CRIMINAL_GANG_MEMBER
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1975-01-01' + (i % 18000), 'YYYY-MM-DD')
      )
      WHEN 12 THEN jsonb_build_object( -- TERRORIST_MEMBER
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1965-01-01' + (i % 22000), 'YYYY-MM-DD')
      )
      WHEN 13 THEN jsonb_build_object( -- BATF_VIOLENT_FELON
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1970-01-01' + (i % 20000), 'YYYY-MM-DD'),
        'fbi_number', 'FBI' || to_char((i*13)%9999999,'FM0000000')
      )
      WHEN 14 THEN jsonb_build_object( -- WITSEC_CHARGED
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1978-01-01' + (i % 17000), 'YYYY-MM-DD')
      )
      ELSE jsonb_build_object( -- INTERSTATE_ID_INDEX
        'name',  (lname || ', ' || initcap(fname)),
        'dob',   to_char(date '1972-01-01' + (i % 19000), 'YYYY-MM-DD'),
        'fbi_number', 'FBI' || to_char((i*17)%9999999,'FM0000000'),
        'ssn',   to_char(100 + (i%900),'FM000') || '-' || to_char(10 + (i%90),'FM00') || '-' || to_char((i*7)%9999,'FM0000'),
        'drivers_number', st || '-' || to_char((i*5)%10000000,'FM0000000')
      )
    END AS payload,

    (st || '-PD')                          AS originating_agency,
    ('CASE-' || to_char(i,'FM000000'))     AS originating_case_number,
    ('NCIC-' || to_char(i,'FM000000'))     AS ncic_number,
    'ACTIVE'                               AS status,
    now() - ((i % 540)) * interval '1 day' AS created_at,
    now()                                  AS updated_at,
    ARRAY['seed','ncic']::text[]           AS tags
  FROM src
  RETURNING id, payload, originating_case_number
)
-- 4) Descriptors (DB generates normalized_value)
INSERT INTO descriptors (record_id, key, value)
SELECT
  id,
  d.key,
  d.val
FROM ins
CROSS JOIN LATERAL (
  VALUES
    ('NAME',                   payload->>'name'),
    ('DOB',                    payload->>'dob'),
    ('VIN',                    payload->>'vin'),
    ('PLATE',                  payload->>'plate'),
    ('SERIAL',                 payload->>'serial'),
    ('HULL_NUMBER',            payload->>'hull_number'),
    ('REGISTRATION',           payload->>'registration'),
    ('OAN',                    payload->>'oan'),
    ('ISSUER',                 payload->>'issuer'),
    ('OWNER_SSN',              payload->>'owner_ssn'),
    ('FBI_NUMBER',             payload->>'fbi_number'),
    ('SSN',                    payload->>'ssn'),
    ('DRIVERS_NUMBER',         payload->>'drivers_number'),
    ('WARRANT_NUMBER',         payload->>'warrant_number'),
    ('ORIGINATING_CASE_NUMBER', originating_case_number)
) AS d(key, val)
WHERE d.val IS NOT NULL AND d.val <> '';

COMMIT;
