from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from .models import Incident
from . import db

bp = Blueprint("incidents", __name__)

@bp.get("/")
@jwt_required()
def list_incidents():
    q = Incident.query
    status = request.args.get("status")
    code = request.args.get("offense_code")
    if status:
        q = q.filter(Incident.status == status)
    if code:
        q = q.filter(Incident.offense_code == code)
    q = q.order_by(Incident.occurred_at.desc()).limit(200)
    items = [{
        "id": i.id,
        "case_no": i.case_no,
        "occurred_at": i.occurred_at.isoformat(),
        "location": i.location,
        "offense_code": i.offense_code,
        "status": i.status,
    } for i in q.all()]
    return {"items": items}
