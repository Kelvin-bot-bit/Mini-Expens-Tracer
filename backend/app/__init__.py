import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is missing. Configure it in backend/.env")

    # Normalize common provider URLs while preserving an explicitly selected driver.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    jwt_secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY is missing. Set a strong secret in backend/.env or the hosting environment.")

    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=jwt_secret,
        JWT_ACCESS_TOKEN_EXPIRES=3600,
        JSON_SORT_KEYS=False,
    )
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Return consistent authentication errors. Flask-JWT-Extended defaults
    # malformed/invalid tokens to HTTP 422, which obscures auth failures in the UI.
    @jwt.invalid_token_loader
    def handle_invalid_token(_reason):
        return jsonify({
            "error": "Invalid access token. Please sign in again."
        }), 401

    @jwt.expired_token_loader
    def handle_expired_token(_jwt_header, _jwt_payload):
        return jsonify({
            "error": "Your session has expired. Please sign in again."
        }), 401

    @jwt.unauthorized_loader
    def handle_missing_token(_reason):
        return jsonify({
            "error": "Missing authorization token. Please sign in again."
        }), 401

    origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False)

    from app.routes import api
    app.register_blueprint(api, url_prefix="/api")

    @app.get("/")
    def index():
        return jsonify({"name": "Mini Expense Tracker API", "status": "ok"})

    return app
