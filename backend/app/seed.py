from . import db
from .models import User, Incident
from faker import Faker
import random
from datetime import datetime, timedelta

def run_seed():
    fake = Faker()
    if not User.query.filter_by(email="analyst@example.com").first():
        u = User(email="analyst@example.com", role="Analyst")
        u.set_password("password123")
        db.session.add(u)

    if Incident.query.count() < 300:
        offenses = ["BURGLARY", "THEFT", "ASSAULT", "FRAUD", "NARCOTICS"]
        statuses = ["OPEN", "CLOSED", "REFERRED"]
        for _ in range(300):
            inc = Incident(
                case_no=fake.bothify("##-######"),
                occurred_at=fake.date_time_between(start_date="-365d", end_date="now"),
                location=fake.street_address(),
                offense_code=random.choice(offenses),
                status=random.choice(statuses),
            )
            db.session.add(inc)
    db.session.commit()
