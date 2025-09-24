#!/usr/bin/env python3
"""
Seed many NCIC records via your API.

Env vars (all optional):
  API_BASE=http://localhost:8080
  SEED_EMAIL=admin@example.com
  SEED_PASSWORD=AdminPass!123
  SEED_TOKEN=eyJ...   # if present, login is skipped
  COUNT=3500
  CONCURRENCY=12
  ORG="FBI-CJIS"      # default originating_agency

Run:
  python backend/app/scripts/seed_bulk_ncic.py
"""
import os, sys, json, time, random, string, threading
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = os.getenv("API_BASE", "http://localhost:8080")
LOGIN_URL = f"{API_BASE}/api/auth/login"
RECORDS_URL = f"{API_BASE}/api/records"

SEED_EMAIL = os.getenv("SEED_EMAIL", "admin@example.com")
SEED_PASSWORD = os.getenv("SEED_PASSWORD", "AdminPass!123")
SEED_TOKEN = os.getenv("SEED_TOKEN", "").strip()
COUNT = int(os.getenv("COUNT", "3500"))
CONCURRENCY = int(os.getenv("CONCURRENCY", "12"))
ORIGINATING_AGENCY = os.getenv("ORG", "FBI-CJIS")

random.seed(42)

# ---------- tiny HTTP helpers (stdlib only) ----------
def _post_json(url: str, obj: dict, headers: dict | None = None) -> dict:
    body = json.dumps(obj).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        ct = resp.headers.get("content-type", "")
        return json.loads(data.decode("utf-8")) if "application/json" in ct else {"_raw": data.decode("utf-8")}

def _login() -> str:
    if SEED_TOKEN:
        return SEED_TOKEN
    try:
        out = _post_json(LOGIN_URL, {"email": SEED_EMAIL, "password": SEED_PASSWORD})
        tok = out.get("access_token")
        if not tok:
            raise SystemExit("Login returned no access_token. Check credentials and API_BASE.")
        return tok
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"[LOGIN ERROR] {e.code} {e.reason}\n{msg}")

# ---------- data generators (descriptor-aligned keys) ----------
FIRST = ["JOHN","JANE","ROBERT","EMILY","ALICE","CARLOS","PRIYA","TOM","SOPHIA","MARTIN","NORA","HANNAH","JACOB","MIA","LUCAS","AVA","NOAH","OLIVIA"]
LAST  = ["DOE","SMITH","BROWN","JOHNSON","LEE","GARCIA","MARTINEZ","DAVIS","RODRIGUEZ","MILLER","WILSON","TAYLOR","THOMAS","WHITE","HARRIS","LEWIS","CLARK","YOUNG"]
STATES = ["FL","WV","VA","PA","TX","CA","WA","NY","OH","NC","AZ","GA","MI","IL","TN","CO","IN","MO"]

VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"  # no I,O,Q
def rvn(n=17): return "".join(random.choice(VIN_CHARS) for _ in range(n))
def rplate():
    st = random.choice(STATES)
    part = "".join(random.choice(string.ascii_uppercase+string.digits) for _ in range(6))
    return f"{st} {part}"
def rname():
    return f"{random.choice(LAST)}, {random.choice(FIRST)}"
def rdob():
    y = random.randint(1950, 2012); m = random.randint(1,12); d = random.randint(1,28)
    return f"{y:04d}-{m:02d}-{d:02d}"
def roan(): return f"OAN-{random.randint(1000,999999)}"
def rserial(prefix="SN"): return f"{prefix}-{random.randint(1000,999999)}"
def rwarrant(): return f"WAR-{random.randint(10000,99999)}"
def rssn():
    return f"{random.randint(100,999)}-{random.randint(10,99):02d}-{random.randint(1000,9999):04d}"
def rsex(): return random.choice(["M","F"])
def rrace(): return random.choice(["W","B","A","I","U"])  # simplified
def rheight(): return random.randint(58,78)
def rweight(): return random.randint(90,260)
def reye(): return random.choice(["BLU","GRN","BRO","HAZ","GRY"])
def rhair(): return random.choice(["BLK","BRN","BLN","RED","GRY"])

# Weighted file type distribution (must sum ~1.0)
FT_WEIGHTS = [
    ("WANTED_PERSON", 0.22),
    ("MISSING_PERSON", 0.14),
    ("STOLEN_VEHICLE", 0.20),
    ("STOLEN_GUN", 0.10),
    ("STOLEN_LICENSE_PLATE", 0.05),
    ("STOLEN_ARTICLE", 0.05),
    ("STOLEN_BOAT", 0.03),
    ("SECURITY", 0.02),
    ("FOREIGN_FUGITIVE", 0.02),
    ("UNIDENTIFIED_PERSON", 0.04),
    ("VIOLENT_CRIMINAL_GANG_MEMBER", 0.04),
    ("TERRORIST_MEMBER", 0.01),
    ("USSS_PROTECTIVE", 0.01),
    ("BATF_VIOLENT_FELON", 0.03),
    ("INTERSTATE_ID_INDEX", 0.04),
]
FT_ACCUM = []
acc = 0.0
for ft,w in FT_WEIGHTS:
    acc += w
    FT_ACCUM.append((acc, ft))
def pick_file_type():
    r = random.random()
    for cutoff,ft in FT_ACCUM:
        if r <= cutoff: return ft
    return FT_ACCUM[-1][1]

def make_payload(ft: str) -> dict:
    if ft == "WANTED_PERSON":
        pl = {"name": rname(), "dob": rdob(), "warrant_number": rwarrant()}
        if random.random() < 0.12: pl["temporary_felony_want"] = True
        if random.random() < 0.25: pl["plate"] = rplate()
        if random.random() < 0.10: pl["vin"] = rvn()
        return pl
    if ft == "MISSING_PERSON":
        return {
            "name": rname(), "dob": rdob(), "age": random.randint(6,80),
            "sex": rsex(), "race": rrace(), "height_in": rheight(), "weight_lb": rweight(),
            "eye_color": reye(), "hair_color": rhair(), "unemancipated": random.random()<0.3,
            "safety_danger": random.random()<0.2,
        }
    if ft == "STOLEN_VEHICLE":
        return {"vin": rvn(), "plate": rplate(), "oan": roan(), "color": random.choice(["RED","BLU","BLK","WHI","GRN","SIL"])}
    if ft == "STOLEN_GUN":
        return {"serial": rserial("GUN"), "make": random.choice(["ACME","OMEGA","DELTA","ATLAS"]), "model": random.choice(["M9","M11","556","AR15"])}
    if ft == "STOLEN_LICENSE_PLATE":
        return {"plate": rplate()}
    if ft == "STOLEN_ARTICLE":
        return {"serial": rserial("ART"), "oan": roan()}
    if ft == "STOLEN_BOAT":
        return {"hull_number": rserial("HULL"), "registration": rserial("REG"), "oan": roan()}
    if ft == "SECURITY":
        return {"serial": rserial("SEC"), "owner_ssn": rssn(), "issuer": random.choice(["BANK A","BANK B","BROKER C"])}
    if ft == "FOREIGN_FUGITIVE":
        return {"name": rname(), "dob": rdob(), "country": random.choice(["CA","MX","GB","DE","FR","BR","JP"])}
    if ft == "UNIDENTIFIED_PERSON":
        return {"sex": rsex(), "race": rrace()}
    if ft == "VIOLENT_CRIMINAL_GANG_MEMBER":
        return {"name": rname(), "dob": rdob()}
    if ft == "TERRORIST_MEMBER":
        return {"name": rname(), "dob": rdob()}
    if ft == "USSS_PROTECTIVE":
        return {"name": rname(), "dob": rdob()}
    if ft == "BATF_VIOLENT_FELON":
        return {"name": rname(), "dob": rdob()}
    if ft == "INTERSTATE_ID_INDEX":
        return {"name": rname(), "dob": rdob()}
    return {"note": "unknown"}

AGENCIES = [ORIGINATING_AGENCY, "WV-STATE-POLICE", "FL-OKALOOSA-SO", "NYSP", "TX-DPS", "USSS", "ATF", "RCMP"]
def make_record():
    ft = pick_file_type()
    rec = {
        "file_type": ft,
        "originating_agency": random.choice(AGENCIES),
        "payload": make_payload(ft),
    }
    if random.random() < 0.20: rec["originating_case_number"] = f"{ft[:3]}-{random.randint(1000,999999)}"
    if random.random() < 0.10: rec["ncic_number"] = f"NCIC-{random.randint(10000,99999)}"
    return rec

# ---------- worker pool ----------
def worker_create(auth_header: dict, rec: dict, attempts=3, backoff=0.5) -> str | None:
    for i in range(attempts):
        try:
            out = _post_json(RECORDS_URL, rec, headers=auth_header)
            return out.get("id")
        except urllib.error.HTTPError as e:
            code = e.code
            if code >= 500 and i < attempts-1:
                time.sleep(backoff * (2**i)); continue
            # 4xx or final attempt
            msg = e.read().decode("utf-8", errors="ignore")
            sys.stderr.write(f"[ERROR {code}] {msg}\n")
            return None
        except Exception as ex:
            if i < attempts-1:
                time.sleep(backoff * (2**i)); continue
            sys.stderr.write(f"[ERROR] {ex}\n")
            return None

def main():
    token = _login()
    auth = {"Authorization": f"Bearer {token}"}

    print(f"Seeding {COUNT} records → {RECORDS_URL} (concurrency={CONCURRENCY})")
    created = 0
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = []
        for _ in range(COUNT):
            rec = make_record()
            futures.append(ex.submit(worker_create, auth, rec))
        for idx, fut in enumerate(as_completed(futures), 1):
            rid = fut.result()
            with lock:
                if rid: created += 1
                if idx % 50 == 0:
                    print(f"{idx:4d}/{COUNT} processed | created={created}")

    print(f"\nDone. Created {created}/{COUNT} records.")

if __name__ == "__main__":
    main()
