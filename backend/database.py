import json
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./docuiq.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)

    # JSON stored as serialized text
    documents_json = Column(Text, default="{}")
    combined_text = Column(Text, default="")
    summary_json = Column(Text, default="{}")
    chat_history_json = Column(Text, default="[]")

    def get_documents(self) -> dict:
        return json.loads(self.documents_json) if self.documents_json else {}

    def set_documents(self, docs: dict):
        self.documents_json = json.dumps(docs)

    def get_summary(self) -> dict:
        return json.loads(self.summary_json) if self.summary_json else {}

    def set_summary(self, summary_dict: dict):
        self.summary_json = json.dumps(summary_dict)

    def get_chat_history(self) -> list:
        return json.loads(self.chat_history_json) if self.chat_history_json else []

    def set_chat_history(self, history: list):
        self.chat_history_json = json.dumps(history)


# Create tables on import
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()