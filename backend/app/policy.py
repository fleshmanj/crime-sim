SENSITIVE_KEYS = {"ssn", "owner_ssn"}

def redact_payload(payload: dict, role: str):
    if role in ("ADMIN", "ANALYST"):
        return payload
    red = dict(payload or {})
    for k in list(red.keys()):
        if k.lower() in SENSITIVE_KEYS:
            red[k] = "***REDACTED***"
    return red
