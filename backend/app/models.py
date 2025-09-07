from . import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = "users"  # <-- rename
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="Analyst")
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

class Incident(db.Model):
    __tablename__ = "incidents"  # optional, but clearer
    id = db.Column(db.Integer, primary_key=True)
    case_no = db.Column(db.String(32), index=True)
    occurred_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    location = db.Column(db.String(255))
    offense_code = db.Column(db.String(64), index=True)
    status = db.Column(db.String(32), default="OPEN", index=True)
