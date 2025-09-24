import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    # --- Config (keeps your existing env-based approach) ---
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "postgresql://crime_user:supersecret@db:5432/crime_sim")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "changeme")

    # --- Init extensions ---
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- Blueprints ---
    # Auth routes (your existing file)
    from .routes_auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    # NCIC Records routes (new)
    from .routes_records import bp as records_bp
    app.register_blueprint(records_bp)  # already has url_prefix="/api/records"

    # If you have other blueprints (e.g., incidents), register them here.

    return app
