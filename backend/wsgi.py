from app import create_app, db
from app.seed import run_seed

app = create_app()

# Run table creation + seed once at startup (in master when preload_app=True)
with app.app_context():
    db.create_all()
    run_seed()
