# app/authz.py
from functools import wraps
from flask import abort
from flask_jwt_extended import jwt_required, get_jwt

def require_role(allowed_roles):
    """
    Usage:
      @bp.get("/secure")
      @require_role(["ADMIN","ANALYST"])
      def secure(): ...
    """
    def deco(fn):
        @wraps(fn)
        @jwt_required()  # ensures a valid JWT first
        def wrapper(*args, **kwargs):
            claims = get_jwt() or {}
            role = claims.get("role")
            if role not in allowed_roles:
                abort(403)
            # If you want access to user info inside your route, just call get_jwt() there.
            return fn(*args, **kwargs)
        return wrapper
    return deco
