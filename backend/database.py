"""
Database models and session management for MetrologiX.
New columns added in this revision:
  - Instrument.n_max  (computed: max_capacity / scale_interval_e)
  - TestSession.rule_version, env_warnings
  - TestReport.rule_version
A lightweight SQLite column-migration runs at startup to add columns
to any existing database without data loss.
"""
from sqlmodel import Field, Session, SQLModel, create_engine, select
from typing import Optional
import uuid
import sqlite3
import os
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./metrologix.db")
_DB_FILE = DATABASE_URL.replace("sqlite:///", "")

engine = create_engine(DATABASE_URL, echo=False)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Instrument(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    model_number: str
    manufacturer: str
    serial_number: str
    accuracy_class: str          # I, II, III, IIII (legacy: IV)
    max_capacity: float
    min_capacity: float
    scale_interval_e: float
    scale_interval_d: float
    n_max: float = 0.0           # = max_capacity / scale_interval_e  (stored for quick reporting)
    unit: str = "kg"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class TestSession(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    instrument_id: str = Field(foreign_key="instrument.id")
    test_type: str               # type_evaluation | verification
    inspector_name: str
    lab_location: str
    ambient_temp_c: float = 20.0
    relative_humidity: float = 50.0
    pressure_hpa: float = 1013.0
    overall_status: str = "pending"   # pending | pass | fail
    rule_version: str = ""            # OIML config version at session creation
    env_warnings: str = ""            # JSON-encoded list of advisory warnings
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None


class TestRecord(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="testsession.id")
    test_module: str             # weighing | eccentricity | repeatability | discrimination | creep | tare | zero_setting | temperature_effect
    load_applied: float = 0.0
    indication_raw: float = 0.0
    delta_load: float = 0.0
    turning_point: float = 0.0
    calculated_error: float = 0.0
    mpe_limit: float = 0.0
    corrected_error: float = 0.0
    is_compliant: bool = True
    sequence_order: int = 0
    direction: str = "increasing"     # increasing | decreasing
    position: str = "center"          # center | ne | nw | sw | se
    temperature_c: float = 20.0
    time_minutes: float = 0.0
    extra_data: str = ""              # JSON blob for module-specific fields (e.g. tare load)


class TestReport(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="testsession.id")
    report_number: str
    sha256_hash: str
    pdf_file_path: str = ""
    docx_file_path: str = ""
    ai_anomaly_score: float = 0.0
    ai_diagnosis: str = ""
    overall_verdict: str = "pass"
    rule_version: str = ""            # OIML config version at report generation
    inspector_sign_name: str = ""
    inspector_sign_designation: str = ""
    inspector_sign_date: str = ""
    issued_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ---------------------------------------------------------------------------
# Startup migration
# ---------------------------------------------------------------------------

_MIGRATIONS: dict[str, list[tuple[str, str]]] = {
    "instrument": [
        ("n_max", "REAL DEFAULT 0"),
    ],
    "testsession": [
        ("rule_version",  "TEXT DEFAULT ''"),
        ("env_warnings",  "TEXT DEFAULT ''"),
        ("completed_at",  "TEXT"),
    ],
    "testreport": [
        ("rule_version",            "TEXT DEFAULT ''"),
        ("docx_file_path",          "TEXT DEFAULT ''"),
        ("inspector_sign_name",     "TEXT DEFAULT ''"),
        ("inspector_sign_designation", "TEXT DEFAULT ''"),
        ("inspector_sign_date",     "TEXT DEFAULT ''"),
    ],
    "testrecord": [
        ("extra_data", "TEXT DEFAULT ''"),
    ],
}


def _run_migrations() -> None:
    """Add missing columns to existing SQLite tables (idempotent)."""
    db_path = _DB_FILE
    if not os.path.exists(db_path):
        return  # fresh DB — SQLModel will create tables with all columns
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for table, columns in _MIGRATIONS.items():
            existing = {
                row[1].lower()
                for row in cur.execute(f"PRAGMA table_info({table})").fetchall()
            }
            for col_name, col_def in columns:
                if col_name.lower() not in existing:
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
        conn.commit()
        conn.close()
    except Exception as exc:
        # Log but don't crash — worst case some columns are missing
        print(f"[DB Migration] Warning: {exc}")


def create_db_and_tables() -> None:
    _run_migrations()           # add columns to any existing DB first
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session