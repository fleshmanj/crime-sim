from functools import wraps
from flask import abort
from flask_jwt_extended import jwt_required, get_jwt

def require_role(allowed_roles):
    """
    Decorator usage:
      @bp.get("/secure")
      @require_role(["ADMIN","ANALYST"])
      def secure(): ...
    """
    def deco(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt() or {}
            role = claims.get("role")
            if role not in allowed_roles:
                abort(403)
            return fn(*args, **kwargs)
        return wrapper
    return deco
