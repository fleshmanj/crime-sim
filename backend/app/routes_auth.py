from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from .models import User
from . import db

bp = Blueprint("auth", __name__)

@bp.post("/login")
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password) or not user.is_active:
        return jsonify({"message": "Invalid credentials"}), 401

    token = create_access_token(identity={"id": user.id, "role": user.role, "email": user.email})
    return {"access_token": token}

@bp.get("/me")
@jwt_required()
def me():
    return get_jwt_identity()
