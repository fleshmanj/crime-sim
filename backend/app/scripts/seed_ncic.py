# backend/scripts/seed_ncic.py
import requests, os

API = os.environ.get('API_URL', 'http://localhost:8080/api/records')
AUTH = {'Authorization': f"Bearer {os.environ['SEED_TOKEN']}"}

samples = [
    {
        'file_type': 'WANTED_PERSON',
        'originating_agency': 'FBI-CJIS',
        'originating_case_number': 'W-2025-001',
        'payload': {
            'name': 'DOE, JOHN',
            'dob': '1985-04-12',
            'fbi_number': '1234567AB',
            'ssn': '123-45-6789',
            'drivers_number': 'FL-D1234567',
            'vehicle_plate': 'FL ABCD12',
            'vehicle_vin': '1HGCM82633A004352',
            'warrant_number': 'WAR-99821',
            'temporary_felony_want': True
        }
    },
    {
        'file_type': 'STOLEN_VEHICLE',
        'originating_agency': 'FL-OKALOOSA-SO',
        'payload': {
            'vin': '1FTFW1E87NFB00001',
            'owner_applied_number': 'OAN-7788',
            'plate': 'FL ZXY901',
            'wanted_for_felony': False
        }
    },
    {
        'file_type': 'STOLEN_GUN',
        'originating_agency': 'ATF',
        'payload': {
            'serial': 'GUN-556-ALPHA',
            'make': 'ACME ARMS',
            'model': 'MODEL 556',
            'status': 'STOLEN'
        }
    },
    {
        'file_type': 'MISSING_PERSON',
        'originating_agency': 'WV-STATE-POLICE',
        'payload': {
            'name': 'SMITH, JANE',
            'dob': '2009-11-01',
            'age': 15,
            'sex': 'F',
            'race': 'W',
            'height_in': 64,
            'weight_lb': 110,
            'eye_color': 'BLU',
            'hair_color': 'BRN',
            'unemancipated': True,
            'safety_danger': True
        }
    }
]

for rec in samples:
    r = requests.post(API, json=rec, headers=AUTH, timeout=10)
    r.raise_for_status()
    print('created', r.json())
