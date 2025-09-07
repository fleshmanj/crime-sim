from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from .models import Incident
from . import db

bp = Blueprint("incidents", __name__)

@bp.get("/")
@jwt_required()
def list_incidents():
    from datetime import datetime
    q = Incident.query

    case_no = request.args.get("case_no")
    status = request.args.get("status")
    code = request.args.get("offense_code")
    location = request.args.get("location")  # substring match
    dt_from = request.args.get("from")       # YYYY-MM-DD
    dt_to = request.args.get("to")           # YYYY-MM-DD

    if case_no:
        q = q.filter(Incident.case_no.ilike(f"%{case_no}%"))
    if status:
        q = q.filter(Incident.status == status)
    if code:
        q = q.filter(Incident.offense_code.ilike(f"%{code}%"))
    if location:
        q = q.filter(Incident.location.ilike(f"%{location}%"))
    if dt_from:
        q = q.filter(Incident.occurred_at >= datetime.fromisoformat(dt_from))
    if dt_to:
        # include entire "to" day by adding 1 day and using <
        q = q.filter(Incident.occurred_at < datetime.fromisoformat(dt_to) + timedelta(days=1))

    items = q.order_by(Incident.occurred_at.desc()).limit(500).all()
    return {"items": [{
        "id": i.id,
        "case_no": i.case_no,
        "occurred_at": i.occurred_at.isoformat(),
        "location": i.location,
        "offense_code": i.offense_code,
        "status": i.status,
    } for i in items]}

