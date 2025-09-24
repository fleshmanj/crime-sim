from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import get_jwt, get_jwt_identity
from sqlalchemy import and_
from . import db
from .models import Record, Descriptor, AuditLog, RecordType
from .services.descriptors import build_descriptors, normalize
from .authz import require_role
from .policy import redact_payload

bp = Blueprint("records", __name__, url_prefix="/api/records")

@bp.post("")
@require_role(["ADMIN", "ANALYST"])
def create_record():
    data = request.get_json(force=True)

    try:
        rtype = RecordType(data["file_type"])
    except Exception:
        abort(400, description="Invalid file_type")

    payload = data.get("payload")
    if not isinstance(payload, dict):
        abort(400, description="payload must be an object")

    rec = Record(
        file_type=rtype,
        payload=payload,
        originating_agency=data.get("originating_agency", "TEST-AGENCY"),
        originating_case_number=data.get("originating_case_number"),
        ncic_number=data.get("ncic_number"),
    )
    db.session.add(rec)
    db.session.flush()  # get rec.id

    # descriptors
    for d in build_descriptors(rec):
        db.session.add(d)

    # audit
    db.session.add(
        AuditLog(
            action="CREATE",
            actor_id=get_jwt_identity(),
            actor_role=(get_jwt() or {}).get("role"),
            record_id=rec.id,
            context={"file_type": rec.file_type.value},
        )
    )

    db.session.commit()
    return jsonify({"id": str(rec.id)}), 201


@bp.get("")
@require_role(["ADMIN", "ANALYST", "DISPATCH_TRAINER"])
def search_records():
    q = request.args
    clauses = []

    ft = q.get("file_type")
    if ft:
        try:
            clauses.append(Record.file_type == RecordType(ft))
        except Exception:
            abort(400, description="Invalid file_type")

    keys = [
        "VIN","PLATE","SERIAL","NAME","DOB","FBI_NUMBER","SSN","DRIVERS_NUMBER","OAN",
        "HULL_NUMBER","REGISTRATION","ISSUER","OWNER_SSN","WARRANT_NUMBER","ORIGINATING_CASE_NUMBER"
    ]
    filters = [(k, normalize(q.get(k))) for k in keys if q.get(k)]
    if filters:
        from sqlalchemy.orm import aliased
        base = db.session.query(Descriptor.record_id).filter(
            and_(Descriptor.key == filters[0][0], Descriptor.normalized_value == filters[0][1])
        )
        for key, nval in filters[1:]:
            D = aliased(Descriptor)
            base = base.join(D, D.record_id == Descriptor.record_id).filter(
                and_(D.key == key, D.normalized_value == nval)
            )
        sub = base.subquery()
        clauses.append(Record.id.in_(db.session.query(sub.c.record_id)))

    qset = (
        Record.query.filter(and_(*clauses))
        .order_by(Record.created_at.desc())
        .limit(int(q.get("limit", 100)))
    )

    role = (get_jwt() or {}).get("role", "ANALYST")
    items = []
    for r in qset.all():
        items.append({
            "id": str(r.id),
            "file_type": r.file_type.value,
            "originating_agency": r.originating_agency,
            "originating_case_number": r.originating_case_number,
            "ncic_number": r.ncic_number,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "effective_until": r.effective_until.isoformat() if r.effective_until else None,
            "payload": redact_payload(r.payload, role),
        })

    db.session.add(
        AuditLog(
            action="SEARCH",
            actor_id=get_jwt_identity(),
            actor_role=role,
            context={"file_type": ft, "filters": [f[0] for f in filters]},
        )
    )
    db.session.commit()
    return jsonify({"items": items})


@bp.post("/clear/<rid>")
@require_role(["ADMIN", "ANALYST"])
def clear_record(rid):
    rec = Record.query.get(rid)
    if not rec:
        abort(404)
    rec.status = "CLEARED"
    db.session.add(
        AuditLog(
            action="CLEAR",
            actor_id=get_jwt_identity(),
            actor_role=(get_jwt() or {}).get("role"),
            record_id=rec.id,
        )
    )
    db.session.commit()
    return {"ok": True}
