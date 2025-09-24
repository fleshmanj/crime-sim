# backend/app/scripts/seed_users.py
import os
from typing import Optional
from ...app import create_app, db
from ..models import User

def upsert_user(email: str, password: str, role: str) -> str:
    email = (email or "").strip().lower()
    if not email or not password:
        return f"SKIP: missing email/password for role {role}"

    with create_app().app_context():
        u: Optional[User] = User.query.filter_by(email=email).first()
        if u:
            changed = []
            # ensure role
            if u.role != role:
                u.role = role
                changed.append("role")
            # ensure active
            if not u.is_active:
                u.is_active = True
                changed.append("is_active")
            # always reset password if env provides (comment out if you prefer not to)
            u.set_password(password)
            changed.append("password")
            if changed:
                db.session.add(u)
                db.session.commit()
                return f"UPDATED: {email} ({', '.join(changed)})"
            return f"UNCHANGED: {email}"
        else:
            # create new
            u = User(email=email, role=role, is_active=True)
            u.set_password(password)
            db.session.add(u)
            db.session.commit()
            return f"CREATED: {email} ({role})"

def main():
    results = []

    # Admin (required)
    results.append(upsert_user(
        os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com"),
        os.getenv("DEFAULT_ADMIN_PASSWORD", "AdminPass!123"),
        "ADMIN",
    ))

    # Analyst (optional, from your compose env)
    analyst_email = os.getenv("DEFAULT_ANALYST_EMAIL", "").strip()
    analyst_password = os.getenv("DEFAULT_ANALYST_PASSWORD", "").strip()
    if analyst_email and analyst_password:
        results.append(upsert_user(analyst_email, analyst_password, "ANALYST"))
    else:
        results.append("SKIP: DEFAULT_ANALYST_* not set")

    # Trainer (optional)
    trainer_email = os.getenv("DEFAULT_TRAINER_EMAIL", "").strip()
    trainer_password = os.getenv("DEFAULT_TRAINER_PASSWORD", "").strip()
    if trainer_email and trainer_password:
        results.append(upsert_user(trainer_email, trainer_password, "DISPATCH_TRAINER"))
    else:
        results.append("SKIP: DEFAULT_TRAINER_* not set")

    print("\n".join(results))

if __name__ == "__main__":
    main()
