from app import create_app, db
from app.seed import run_seed

app = create_app()

# one-time seed if DB empty (safe for dev)
with app.app_context():
    db.create_all()
    run_seed()
