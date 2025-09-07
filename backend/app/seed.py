from . import db
from .models import User, Incident
from faker import Faker
import os, random

def upsert_user(email, password, role):
    u = User.query.filter_by(email=email.lower()).first()
    if not u:
        u = User(email=email.lower(), role=role, is_active=True)
        u.set_password(password)
        db.session.add(u)

def run_seed():
    fake = Faker()

    # users (safe if already exist)
    upsert_user(
        os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com"),
        os.getenv("DEFAULT_ADMIN_PASSWORD", "AdminPass!123"),
        "Admin",
    )
    upsert_user(
        os.getenv("DEFAULT_ANALYST_EMAIL", "analyst@example.com"),
        os.getenv("DEFAULT_ANALYST_PASSWORD", "password123"),
        "Analyst",
    )
    db.session.commit()

    # incidents (only top-up if low)
    target = int(os.getenv("SEED_INCIDENTS", "300"))
    count = Incident.query.count()
    if count < target:
        offenses = ["BURGLARY", "THEFT", "ASSAULT", "FRAUD", "NARCOTICS"]
        statuses = ["OPEN", "CLOSED", "REFERRED"]
        for _ in range(target - count):
            inc = Incident(
                case_no=fake.bothify("##-######"),
                occurred_at=fake.date_time_between(start_date="-365d", end_date="now"),
                location=fake.street_address(),
                offense_code=random.choice(offenses),
                status=random.choice(statuses),
            )
            db.session.add(inc)
        db.session.commit()
