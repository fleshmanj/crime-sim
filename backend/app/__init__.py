from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from .config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # CORS for local React (adjust in production)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)

    from .routes_auth import bp as auth_bp
    from .routes_incidents import bp as incidents_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(incidents_bp, url_prefix="/api/incidents")

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app
