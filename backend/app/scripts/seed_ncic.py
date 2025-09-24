#!/usr/bin/env python3
# backend/app/scripts/seed_ncic.py
import os, json, sys, urllib.request, urllib.error

API_BASE = os.getenv("API_BASE", "http://localhost:8080")
LOGIN_URL = f"{API_BASE}/api/auth/login"
RECORDS_URL = f"{API_BASE}/api/records"

SEED_EMAIL = os.getenv("SEED_EMAIL", os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com"))
SEED_PASSWORD = os.getenv("SEED_PASSWORD", os.getenv("DEFAULT_ADMIN_PASSWORD", "AdminPass!123"))
SEED_TOKEN = os.getenv("SEED_TOKEN", "").strip()

def _post_json(url: str, data: dict, headers: dict | None = None):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def _login_if_needed() -> str:
    if SEED_TOKEN:
        return SEED_TOKEN
    payload = {"email": SEED_EMAIL, "password": SEED_PASSWORD}
    try:
        out = _post_json(LOGIN_URL, payload)
        token = out.get("access_token")
        if not token:
            raise SystemExit("Login returned no access_token")
        return token
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"[LOGIN ERROR] {e.code} {e.reason}\n{msg}\n"
                         f"Hint: ensure user exists and API is reachable at {LOGIN_URL}")

def main():
    token = _login_if_needed()
    auth = {"Authorization": f"Bearer {token}"}

    samples = [
        {
            "file_type": "WANTED_PERSON",
            "originating_agency": "FBI-CJIS",
            "originating_case_number": "W-2025-001",
            "payload": {
                "name": "DOE, JOHN",
                "dob": "1985-04-12",
                "temporary_felony_want": True,
                "warrant_number": "WAR-99821",
            },
        },
        {
            "file_type": "STOLEN_VEHICLE",
            "originating_agency": "FL-OKALOOSA-SO",
            "payload": {
                "vin": "1FTFW1E87NFB00001",
                "oan": "OAN-7788",
                "plate": "FL ZXY901",
                "wanted_for_felony": False,
            },
        },
        {
            "file_type": "STOLEN_GUN",
            "originating_agency": "ATF",
            "payload": {
                "serial": "GUN-556-ALPHA",
                "make": "ACME ARMS",
                "model": "MODEL 556",
                "status": "STOLEN",
            },
        },
        {
            "file_type": "MISSING_PERSON",
            "originating_agency": "WV-STATE-POLICE",
            "payload": {
                "name": "SMITH, JANE",
                "dob": "2009-11-01",
                "age": 15,
                "sex": "F",
                "race": "W",
                "height_in": 64,
                "weight_lb": 110,
                "eye_color": "BLU",
                "hair_color": "BRN",
                "unemancipated": True,
                "safety_danger": True,
            },
        },
    ]

    created = 0
    for rec in samples:
        try:
            out = _post_json(RECORDS_URL, rec, headers=auth)
            rid = out.get("id", "<unknown>")
            created += 1
            print(f"CREATED {rec['file_type']:>16} → id={rid}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            print(f"[ERROR] {rec['file_type']}: {e.code} {e.reason}\n{body}\n", file=sys.stderr)

    print(f"\nDone. Created {created}/{len(samples)} records.")

if __name__ == "__main__":
    main()
