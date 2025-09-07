from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from .models import User
from . import db

bp = Blueprint("auth", __name__)

@bp.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password) or not user.is_active:
        return jsonify({"message": "Invalid credentials"}), 401

    # ✅ identity must be a STRING (the JWT "sub")
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "email": user.email,
            "role": user.role,
        },
    )
    return {"access_token": access_token}

@bp.get("/me")
@jwt_required()
def me():
    # identity is a string user_id
    user_id = get_jwt_identity()
    claims = get_jwt()  # includes our additional_claims above
    return {
        "id": user_id,
        "email": claims.get("email"),
        "role": claims.get("role"),
    }
