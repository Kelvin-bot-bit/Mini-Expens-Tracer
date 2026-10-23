
"""API routes for the Mini Expense Tracker."""

from datetime import date
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.models import Transaction, User

api = Blueprint("api", __name__)


def error(message, status=400):
    """Return a standardized JSON error response."""
    return jsonify({"error": message}), status


def current_user_id():
    """Return the authenticated user's database ID."""
    return int(get_jwt_identity())


def parse_transaction_payload(data, partial=False):
    """Validate and normalize transaction input."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    result = {}
    allowed = {
        "title",
        "amount",
        "kind",
        "category",
        "transaction_date",
        "note",
    }

    unexpected = set(data) - allowed
    if unexpected:
        raise ValueError(
            f"Unexpected field: {sorted(unexpected)[0]}"
        )

    required = {
        "title",
        "amount",
        "kind",
        "category",
        "transaction_date",
    }

    if not partial:
        missing = required - set(data)
        if missing:
            raise ValueError(
                "Missing required fields: "
                + ", ".join(sorted(missing))
            )

    for key in allowed:
        if key not in data:
            continue

        value = data[key]

        if key == "title":
            if not isinstance(value, str):
                raise ValueError("Title must be a string.")

            value = value.strip()
            if not value or len(value) > 120:
                raise ValueError(
                    "Title must contain 1–120 characters."
                )

        elif key == "amount":
            try:
                value = Decimal(str(value))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise ValueError(
                    "Amount must be a valid number."
                ) from exc

            if (
                not value.is_finite()
                or value <= 0
                or value > Decimal("9999999999.99")
            ):
                raise ValueError(
                    "Amount must be greater than zero "
                    "and within the supported range."
                )

            value = value.quantize(Decimal("0.01"))

        elif key == "kind":
            if not isinstance(value, str):
                raise ValueError(
                    "Kind must be income or expense."
                )

            value = value.strip().lower()
            if value not in ("income", "expense"):
                raise ValueError(
                    "Kind must be income or expense."
                )

        elif key == "category":
            if not isinstance(value, str):
                raise ValueError("Category must be a string.")

            value = value.strip()
            if not value or len(value) > 50:
                raise ValueError(
                    "Category must contain 1–50 characters."
                )

        elif key == "transaction_date":
            try:
                value = date.fromisoformat(str(value))
            except (ValueError, TypeError) as exc:
                raise ValueError(
                    "Transaction date must use YYYY-MM-DD."
                ) from exc

        elif key == "note":
            value = str(value or "").strip()
            if len(value) > 500:
                raise ValueError(
                    "Note cannot exceed 500 characters."
                )

        result[key] = value

    return result


@api.get("/health")
def health():
    """Check API and database availability."""
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({
            "status": "ok",
            "database": "connected",
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "database": "unavailable",
        }), 503


@api.post("/auth/register")
def register():
    """Register a new user and return an access token."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error("Request body must be a JSON object.")

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not name or len(name) > 80:
        return error(
            "Name is required and must be at most 80 characters."
        )

    if "@" not in email or len(email) > 255:
        return error("Enter a valid email address.")

    if (
        not isinstance(password, str)
        or len(password) < 8
        or len(password) > 128
    ):
        return error("Password must be 8–128 characters.")

    if User.query.filter_by(email=email).first():
        return error(
            "An account with this email already exists.",
            409,
        )

    user = User(name=name, email=email)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))

    return jsonify({
        "access_token": token,
        "user": user.to_dict(),
    }), 201


@api.post("/auth/login")
def login():
    """Authenticate a user and return an access token."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error("Request body must be a JSON object.")

    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()

    if (
        not user
        or not isinstance(password, str)
        or not user.check_password(password)
    ):
        return error("Invalid email or password.", 401)

    token = create_access_token(identity=str(user.id))

    return jsonify({
        "access_token": token,
        "user": user.to_dict(),
    }), 200


@api.get("/auth/me")
@jwt_required()
def me():
    """Return the currently authenticated user's details."""
    user = db.session.get(User, current_user_id())

    if not user:
        return error("User not found.", 404)

    return jsonify({"user": user.to_dict()}), 200


@api.get("/transactions")
@jwt_required()
def list_transactions():
    """List the authenticated user's transactions with filters."""
    query = Transaction.query.filter_by(
        user_id=current_user_id()
    )

    kind = request.args.get("kind")
    category = request.args.get("category")
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    search = request.args.get("search", "").strip()

    if kind:
        if kind not in ("income", "expense"):
            return error("kind must be income or expense.")

        query = query.filter_by(kind=kind)

    if category:
        query = query.filter_by(category=category)

    if start:
        try:
            start_date = date.fromisoformat(start)
        except ValueError:
            return error("start_date must use YYYY-MM-DD.")

        query = query.filter(
            Transaction.transaction_date >= start_date
        )

    if end:
        try:
            end_date = date.fromisoformat(end)
        except ValueError:
            return error("end_date must use YYYY-MM-DD.")

        query = query.filter(
            Transaction.transaction_date <= end_date
        )

    if search:
        query = query.filter(
            Transaction.title.ilike(f"%{search}%")
        )

    items = query.order_by(
        Transaction.transaction_date.desc(),
        Transaction.id.desc(),
    ).limit(500).all()

    return jsonify({
        "transactions": [item.to_dict() for item in items]
    }), 200


@api.post("/transactions")
@jwt_required()
def create_transaction():
    """Create a transaction for the authenticated user."""
    try:
        payload = parse_transaction_payload(
            request.get_json(silent=True)
        )
    except ValueError as exc:
        return error(str(exc))

    item = Transaction(
        user_id=current_user_id(),
        **payload,
    )

    db.session.add(item)
    db.session.commit()

    return jsonify({"transaction": item.to_dict()}), 201


@api.get("/transactions/<int:transaction_id>")
@jwt_required()
def get_transaction(transaction_id):
    """Retrieve a transaction belonging to the current user."""
    item = Transaction.query.filter_by(
        id=transaction_id,
        user_id=current_user_id(),
    ).first()

    if not item:
        return error("Transaction not found.", 404)

    return jsonify({"transaction": item.to_dict()}), 200


@api.put("/transactions/<int:transaction_id>")
@jwt_required()
def update_transaction(transaction_id):
    """Update a transaction belonging to the current user."""
    item = Transaction.query.filter_by(
        id=transaction_id,
        user_id=current_user_id(),
    ).first()

    if not item:
        return error("Transaction not found.", 404)

    try:
        payload = parse_transaction_payload(
            request.get_json(silent=True),
            partial=True,
        )
    except ValueError as exc:
        return error(str(exc))

    for key, value in payload.items():
        setattr(item, key, value)

    db.session.commit()

    return jsonify({"transaction": item.to_dict()}), 200


@api.delete("/transactions/<int:transaction_id>")
@jwt_required()
def delete_transaction(transaction_id):
    """Delete a transaction belonging to the current user."""
    item = Transaction.query.filter_by(
        id=transaction_id,
        user_id=current_user_id(),
    ).first()

    if not item:
        return error("Transaction not found.", 404)

    db.session.delete(item)
    db.session.commit()

    return jsonify({"message": "Transaction deleted."}), 200


@api.get("/dashboard/summary")
@jwt_required()
def dashboard_summary():
    """Return totals, monthly expenses, categories, and recent activity."""
    user_id = current_user_id()

    rows = db.session.query(
        Transaction.kind,
        func.coalesce(func.sum(Transaction.amount), 0),
    ).filter_by(
        user_id=user_id
    ).group_by(
        Transaction.kind
    ).all()

    totals = {"income": 0.0, "expense": 0.0}

    for kind, amount in rows:
        totals[kind] = float(amount)

    monthly_rows = db.session.query(
        func.to_char(
            Transaction.transaction_date,
            "YYYY-MM",
        ).label("month"),
        func.coalesce(
            func.sum(Transaction.amount),
            0,
        ).label("total"),
    ).filter(
        Transaction.user_id == user_id,
        Transaction.kind == "expense",
    ).group_by(
        "month"
    ).order_by(
        "month"
    ).limit(12).all()

    category_rows = db.session.query(
        Transaction.category,
        func.coalesce(func.sum(Transaction.amount), 0),
    ).filter_by(
        user_id=user_id,
        kind="expense",
    ).group_by(
        Transaction.category
    ).order_by(
        func.sum(Transaction.amount).desc()
    ).limit(8).all()

    recent = Transaction.query.filter_by(
        user_id=user_id
    ).order_by(
        Transaction.transaction_date.desc(),
        Transaction.id.desc(),
    ).limit(5).all()

    return jsonify({
        "income": totals["income"],
        "expense": totals["expense"],
        "balance": totals["income"] - totals["expense"],
        "monthly_expenses": [
            {"month": month, "total": float(total)}
            for month, total in monthly_rows
        ],
        "category_expenses": [
            {"category": category, "total": float(total)}
            for category, total in category_rows
        ],
        "recent_transactions": [
            item.to_dict() for item in recent
        ],
    }), 200
