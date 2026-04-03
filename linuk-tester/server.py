import csv
import io
import json
import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                         String, Text, func, text)
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine

# --- Application Configuration ---
TEST_QUESTION_COUNT = 24
TEST_DURATION_MINUTES = 45
TEST_PASS_MARK = 18
STATS_LOOKBACK_DAYS = 30

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="LinUK Tester Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Database Setup ---
DB_PATH = os.path.join(os.path.dirname(__file__), 'db', 'questions.db')
engine = create_engine(f'sqlite:///{DB_PATH}', connect_args={"check_same_thread": False})
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Models ---

class Question(Base):
    __tablename__ = 'questions'
    id = Column(Integer, primary_key=True)
    topic = Column(String, nullable=False, index=True)
    question = Column(String, nullable=False)
    options = Column(Text, nullable=False)  # JSON encoded
    correct_answer = Column(String, nullable=False)
    explanation = Column(String, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "topic": self.topic,
            "question": self.question,
            "options": json.loads(self.options),
            "correctAnswer": self.correct_answer,
            "explanation": self.explanation
        }


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    pin_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = 'user_sessions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


class TestSession(Base):
    __tablename__ = 'test_sessions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    score = Column(Float, nullable=False)
    total_questions = Column(Integer, nullable=False)


class UserResponse(Base):
    __tablename__ = 'user_responses'
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('test_sessions.id'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    question_id = Column(Integer, ForeignKey('questions.id'), nullable=True)
    topic = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


# --- Pydantic Schemas ---

class QuestionResponseItem(BaseModel):
    topic: str
    is_correct: bool
    question_id: Optional[int] = None


class ProgressRecordPayload(BaseModel):
    score: float
    total_questions: int
    responses: List[QuestionResponseItem]


class AuthPayload(BaseModel):
    username: str
    pin: str


# --- DB Init ---
Base.metadata.create_all(bind=engine)


@app.on_event("startup")
async def ensure_indexes():
    with engine.connect() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_questions_topic ON questions (topic)"))
        # Add columns to existing tables if they don't exist (safe migrations)
        try:
            conn.execute(text("ALTER TABLE test_sessions ADD COLUMN user_id INTEGER REFERENCES users(id)"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE user_responses ADD COLUMN user_id INTEGER REFERENCES users(id)"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE user_responses ADD COLUMN question_id INTEGER REFERENCES questions(id)"))
        except Exception:
            pass
        conn.commit()


# --- Auth Helpers ---

def _hash_pin(pin: str, salt: str) -> str:
    import hashlib
    dk = hashlib.pbkdf2_hmac('sha256', pin.encode('utf-8'), salt.encode('utf-8'), 100000)
    return dk.hex()


def _generate_salt() -> str:
    import secrets
    return secrets.token_hex(16)


def _generate_token() -> str:
    import secrets
    return secrets.token_urlsafe(32)


def get_current_user(session_token: Optional[str] = Cookie(None)) -> Optional[int]:
    """Returns user_id if authenticated, else None (guest)."""
    if not session_token:
        return None
    db = SessionLocal()
    try:
        session = db.query(UserSession).filter(
            UserSession.token == session_token,
            UserSession.expires_at > datetime.utcnow()
        ).first()
        return session.user_id if session else None
    finally:
        db.close()


def require_user(session_token: Optional[str] = Cookie(None)) -> int:
    """Like get_current_user but raises 401 if not authenticated."""
    user_id = get_current_user(session_token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


# --- Static Files ---
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")


# --- Page Routes ---

@app.get("/")
async def root():
    return FileResponse("index.html")

@app.get("/sw.js")
async def get_sw():
    return FileResponse("sw.js", media_type="application/javascript")

@app.get("/manifest.json")
async def get_manifest():
    return FileResponse("manifest.json", media_type="application/json")

@app.get("/test_runner.html")
async def get_test_runner():
    return FileResponse("test_runner.html")


# --- Auth Endpoints ---

@app.post("/api/auth/register")
async def register(payload: AuthPayload, response: Response):
    if len(payload.pin) < 4 or not payload.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    if len(payload.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == payload.username.strip()).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        salt = _generate_salt()
        pin_hash = _hash_pin(payload.pin, salt)
        user = User(username=payload.username.strip(), pin_hash=pin_hash, salt=salt)
        db.add(user)
        db.flush()
        token = _generate_token()
        user_session = UserSession(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.add(user_session)
        db.commit()
        response.set_cookie("session_token", token, httponly=True, max_age=30 * 24 * 3600, samesite="lax")
        return {"status": "registered", "username": user.username}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/auth/login")
async def login(payload: AuthPayload, response: Response):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == payload.username.strip()).first()
        if not user or _hash_pin(payload.pin, user.salt) != user.pin_hash:
            raise HTTPException(status_code=401, detail="Invalid username or PIN")
        token = _generate_token()
        user_session = UserSession(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.add(user_session)
        db.commit()
        response.set_cookie("session_token", token, httponly=True, max_age=30 * 24 * 3600, samesite="lax")
        return {"status": "logged_in", "username": user.username}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        db = SessionLocal()
        try:
            db.query(UserSession).filter(UserSession.token == session_token).delete()
            db.commit()
        finally:
            db.close()
    response.delete_cookie("session_token")
    return {"status": "logged_out"}


@app.get("/api/auth/me")
async def get_me(session_token: Optional[str] = Cookie(None)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = SessionLocal()
    try:
        session = db.query(UserSession).filter(
            UserSession.token == session_token,
            UserSession.expires_at > datetime.utcnow()
        ).first()
        if not session:
            raise HTTPException(status_code=401, detail="Session expired or invalid")
        user = db.query(User).filter(User.id == session.user_id).first()
        return {"user_id": user.id, "username": user.username}
    finally:
        db.close()


# --- Quiz Endpoints ---

@app.get("/api/index")
async def get_index():
    session = SessionLocal()
    try:
        topics_count = session.query(Question.topic, func.count(Question.id)).group_by(Question.topic).all()
        topics = [{"name": t[0], "count": t[1]} for t in topics_count]
        return {
            "topics": topics,
            "tests": [{"id": "dynamic"}]
        }
    finally:
        session.close()


@app.get("/api/topics/{topic_name}")
async def get_topic_questions(topic_name: str, limit: int = 10, offset: int = 0):
    session = SessionLocal()
    try:
        total = session.query(func.count(Question.id)).filter(Question.topic == topic_name).scalar()
        if total == 0:
            raise HTTPException(status_code=404, detail="Topic not found or empty")
        if offset > 0:
            questions = session.query(Question).filter(Question.topic == topic_name)\
                .order_by(Question.id).offset(offset).limit(limit).all()
        else:
            questions = session.query(Question).filter(Question.topic == topic_name)\
                .order_by(func.random()).limit(limit).all()
        return {
            "questions": [q.to_dict() for q in questions],
            "total": total,
            "offset": offset,
            "limit": limit
        }
    finally:
        session.close()


@app.get("/api/test")
@limiter.limit("10/minute")
async def get_test(request: Request, limit: int = TEST_QUESTION_COUNT):
    session = SessionLocal()
    try:
        questions = session.query(Question).order_by(func.random()).limit(limit).all()
        if not questions:
            raise HTTPException(status_code=404, detail="No questions available")
        return [q.to_dict() for q in questions]
    finally:
        session.close()


# --- Progress Endpoints ---

@app.post("/api/progress/record")
async def record_progress(payload: ProgressRecordPayload,
                           session_token: Optional[str] = Cookie(None)):
    user_id = get_current_user(session_token)
    session = SessionLocal()
    try:
        new_session = TestSession(
            user_id=user_id,
            score=payload.score,
            total_questions=payload.total_questions,
            timestamp=datetime.utcnow()
        )
        session.add(new_session)
        session.flush()

        for resp in payload.responses:
            new_resp = UserResponse(
                session_id=new_session.id,
                user_id=user_id,
                question_id=resp.question_id,
                topic=resp.topic,
                is_correct=resp.is_correct,
                timestamp=datetime.utcnow()
            )
            session.add(new_resp)

        session.commit()
        return {"status": "success", "session_id": new_session.id}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@app.get("/api/progress/stats")
async def get_progress_stats(period: str = "30d",
                              session_token: Optional[str] = Cookie(None)):
    user_id = get_current_user(session_token)
    session = SessionLocal()
    try:
        if period == "all":
            date_filter = None
        else:
            try:
                days = int(period.rstrip('d'))
            except ValueError:
                days = STATS_LOOKBACK_DAYS
            date_filter = datetime.utcnow() - timedelta(days=days)

        # Base query filters for user isolation
        def user_filter(q, model):
            if user_id is not None:
                return q.filter(model.user_id == user_id)
            return q

        # 1. Activity Trend
        activity_q = session.query(
            func.date(UserResponse.timestamp).label("day"),
            func.count(UserResponse.id).label("count")
        )
        activity_q = user_filter(activity_q, UserResponse)
        if date_filter:
            activity_q = activity_q.filter(UserResponse.timestamp >= date_filter)
        activity_q = activity_q.group_by(func.date(UserResponse.timestamp))\
            .order_by(func.date(UserResponse.timestamp))
        activity_trend = [{"date": r.day, "count": r.count} for r in activity_q.all()]

        # 2. Score Trend
        score_q = session.query(
            func.date(TestSession.timestamp).label("day"),
            func.avg(TestSession.score).label("avg_score")
        )
        score_q = user_filter(score_q, TestSession)
        if date_filter:
            score_q = score_q.filter(TestSession.timestamp >= date_filter)
        score_q = score_q.group_by(func.date(TestSession.timestamp))\
            .order_by(func.date(TestSession.timestamp))
        score_trend = [{"date": r.day, "avg_score": round(r.avg_score, 2)} for r in score_q.all()]

        # 3. Topic Performance (always all-time)
        totals_q = session.query(
            UserResponse.topic,
            func.count(UserResponse.id).label("total")
        )
        totals_q = user_filter(totals_q, UserResponse)
        topic_totals = totals_q.group_by(UserResponse.topic).all()

        corrects_q = session.query(
            UserResponse.topic,
            func.count(UserResponse.id).label("correct")
        ).filter(UserResponse.is_correct == True)
        corrects_q = user_filter(corrects_q, UserResponse)
        topic_corrects = corrects_q.group_by(UserResponse.topic).all()

        correct_map = {r.topic: r.correct for r in topic_corrects}
        topic_performance = []
        for r in topic_totals:
            correct = correct_map.get(r.topic, 0)
            percentage = (correct / r.total) * 100 if r.total > 0 else 0
            topic_performance.append({
                "topic": r.topic,
                "percentage": round(percentage, 2),
                "total_answered": r.total
            })

        return {
            "activity_trend": activity_trend,
            "score_trend": score_trend,
            "topic_performance": topic_performance
        }
    finally:
        session.close()


@app.get("/api/progress/export")
async def export_progress(session_token: Optional[str] = Cookie(None)):
    user_id = get_current_user(session_token)
    session = SessionLocal()
    try:
        q = session.query(TestSession).order_by(TestSession.timestamp)
        if user_id is not None:
            q = q.filter(TestSession.user_id == user_id)
        sessions = q.all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["session_id", "timestamp", "score_percent", "total_questions"])
        for s in sessions:
            writer.writerow([s.id, s.timestamp.isoformat(), round(s.score, 2), s.total_questions])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=progress_export.csv"}
        )
    finally:
        session.close()


@app.get("/api/progress/questions")
async def get_question_history(limit: int = 50, session_token: Optional[str] = Cookie(None)):
    user_id = get_current_user(session_token)
    session = SessionLocal()
    try:
        q = session.query(
            UserResponse.question_id,
            Question.question,
            func.count(UserResponse.id).label("attempts"),
            func.sum(
                func.cast(UserResponse.is_correct, Integer)
            ).label("correct_count")
        ).join(Question, Question.id == UserResponse.question_id, isouter=True)\
         .filter(UserResponse.question_id.isnot(None))
        if user_id is not None:
            q = q.filter(UserResponse.user_id == user_id)
        results = q.group_by(UserResponse.question_id)\
            .order_by(func.count(UserResponse.id).desc())\
            .limit(limit).all()
        return [
            {
                "question_id": r.question_id,
                "question": r.question,
                "attempts": r.attempts,
                "correct_count": r.correct_count or 0
            }
            for r in results
        ]
    finally:
        session.close()
