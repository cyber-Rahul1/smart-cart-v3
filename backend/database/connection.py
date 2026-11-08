import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    # Safe local fallback for testing/dev if Postgres is not configured
    db_path = os.path.join(os.path.dirname(__file__), "..", "smartcart_relational.db")
    DATABASE_URL = f"sqlite:///{os.path.abspath(db_path)}"

# In SQLite we allow thread sharing; in Postgres we use connection pooling
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
