import enum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, ENUM as PGEnum
from sqlalchemy import func, Computed
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

# -----------------------
# Users (for routes_auth)
# -----------------------
class Role(enum.Enum):
    ADMIN = "ADMIN"
    ANALYST = "ANALYST"
    DISPATCH_TRAINER = "DISPATCH_TRAINER"

class User(db.Model):
    __tablename__ = "users"

    # Align to existing DB: INTEGER PK (auto-increment)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(32), nullable=False, default=Role.ANALYST.value)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

# -----------------------
# NCIC core models
# -----------------------
class RecordType(enum.Enum):
    WANTED_PERSON = 'WANTED_PERSON'
    FOREIGN_FUGITIVE = 'FOREIGN_FUGITIVE'
    MISSING_PERSON = 'MISSING_PERSON'
    UNIDENTIFIED_PERSON = 'UNIDENTIFIED_PERSON'
    STOLEN_VEHICLE = 'STOLEN_VEHICLE'
    STOLEN_LICENSE_PLATE = 'STOLEN_LICENSE_PLATE'
    STOLEN_BOAT = 'STOLEN_BOAT'
    STOLEN_GUN = 'STOLEN_GUN'
    STOLEN_ARTICLE = 'STOLEN_ARTICLE'
    SECURITY = 'SECURITY'
    USSS_PROTECTIVE = 'USSS_PROTECTIVE'
    VIOLENT_CRIMINAL_GANG_MEMBER = 'VIOLENT_CRIMINAL_GANG_MEMBER'
    TERRORIST_MEMBER = 'TERRORIST_MEMBER'
    BATF_VIOLENT_FELON = 'BATF_VIOLENT_FELON'
    WITSEC_CHARGED = 'WITSEC_CHARGED'
    INTERSTATE_ID_INDEX = 'INTERSTATE_ID_INDEX'

class Record(db.Model):
    __tablename__ = 'records'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    file_type = db.Column(PGEnum(RecordType, name='record_type', create_type=False), nullable=False)
    payload = db.Column(JSONB, nullable=False)

    originating_agency = db.Column(db.String(128), nullable=False)
    originating_case_number = db.Column(db.String(64))
    ncic_number = db.Column(db.String(32))
    status = db.Column(db.String(24), default='ACTIVE')

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    effective_until = db.Column(db.DateTime(timezone=True))
    tags = db.Column(ARRAY(db.Text), default=list)

class Descriptor(db.Model):
    __tablename__ = 'descriptors'
    id = db.Column(db.BigInteger, primary_key=True)
    record_id = db.Column(UUID(as_uuid=True), db.ForeignKey('records.id', ondelete='CASCADE'))
    key = db.Column(db.String(64), nullable=False)
    value = db.Column(db.Text, nullable=False)
    normalized_value = db.Column(
        db.Text,
        Computed(r"regexp_replace(upper(value), '\s+', '', 'g')", persisted=True),
        nullable=False,
    )

class AuditLog(db.Model):
    __tablename__ = 'audit_log'

    id = db.Column(db.BigInteger, primary_key=True)
    occurred_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    # Store actor_id as string so it matches whatever your JWT identity is (e.g., "1")
    actor_id = db.Column(db.Text)
    actor_role = db.Column(db.String(64))
    action = db.Column(db.String(32), nullable=False)
    record_id = db.Column(UUID(as_uuid=True))
    context = db.Column(JSONB)
