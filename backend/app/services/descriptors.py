
from backend.app.models import Descriptor
def _norm(v: str) -> str:
    return ''.join((v or '').upper().split())

# Which payload keys to index per file type
INDEX_KEYS = {
    'WANTED_PERSON': ['NAME','DOB','FBI_NUMBER','SSN','DRIVERS_NUMBER','MISC_ID','PLATE','VIN','ORIGINATING_CASE_NUMBER','WARRANT_NUMBER'],
    'FOREIGN_FUGITIVE': ['NAME','DOB','COUNTRY'],
    'MISSING_PERSON': ['NAME','DOB'],
    'UNIDENTIFIED_PERSON': ['SEX','RACE'],
    'STOLEN_VEHICLE': ['VIN','OAN','PLATE'],
    'STOLEN_LICENSE_PLATE': ['PLATE'],
    'STOLEN_BOAT': ['HULL_NUMBER','REGISTRATION','OAN'],
    'STOLEN_GUN': ['SERIAL','MAKE','MODEL'],
    'STOLEN_ARTICLE': ['SERIAL','OAN'],
    'SECURITY': ['SERIAL','OWNER_SSN','ISSUER'],
    'VIOLENT_CRIMINAL_GANG_MEMBER': ['NAME','DOB'],
    'TERRORIST_MEMBER': ['NAME','DOB'],
}

def build_descriptors(record):
    keys = INDEX_KEYS.get(record.file_type.value, [])
    payload = record.payload or {}
    rows = []
    for K in keys:
        pk = K.lower()
        if pk in payload and payload[pk]:
            v = str(payload[pk])
            rows.append(Descriptor(record_id=record.id, key=K, value=v, normalized_value=_norm(v)))
    return rows

def normalize(v: str) -> str:
    return _norm(v)
