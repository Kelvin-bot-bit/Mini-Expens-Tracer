from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app import db

def utcnow():
    return datetime.now(timezone.utc)

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    transactions = db.relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email}

class Transaction(db.Model):
    __tablename__ = "transactions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    kind = db.Column(db.String(10), nullable=False)  # income or expense
    category = db.Column(db.String(50), nullable=False)
    transaction_date = db.Column(db.Date, nullable=False, index=True)
    note = db.Column(db.String(500), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    user = db.relationship("User", back_populates="transactions")

    __table_args__ = (
        db.CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
        db.CheckConstraint("kind IN ('income', 'expense')", name="ck_transaction_kind"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "amount": float(self.amount),
            "kind": self.kind,
            "category": self.category,
            "transaction_date": self.transaction_date.isoformat(),
            "note": self.note or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
