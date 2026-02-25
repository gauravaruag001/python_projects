import json
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, Text, func, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List
import random
import os

app = FastAPI(title="LinUK Tester Backend")

# Setup SQLAlchemy
DB_PATH = os.path.join(os.path.dirname(__file__), 'db', 'questions.db')
engine = create_engine(f'sqlite:///{DB_PATH}')
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Question(Base):
    __tablename__ = 'questions'
    id = Column(Integer, primary_key=True)
    topic = Column(String, nullable=False)
    question = Column(String, nullable=False)
    options = Column(Text, nullable=False) # JSON encoded
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

class TestSession(Base):
    __tablename__ = 'test_sessions'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    score = Column(Float, nullable=False)
    total_questions = Column(Integer, nullable=False)

class UserResponse(Base):
    __tablename__ = 'user_responses'
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('test_sessions.id'), nullable=True)
    topic = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

# Pydantic models for API
class QuestionResponseItem(BaseModel):
    topic: str
    is_correct: bool

class ProgressRecordPayload(BaseModel):
    score: float
    total_questions: int
    responses: List[QuestionResponseItem]

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# Mount static files (css, js)
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

# Mount root and service worker explicitly because StaticFiles doesn't handle root index nicely sometimes
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


# API Endpoints
@app.get("/api/index")
async def get_index():
    session = SessionLocal()
    try:
        # Group by topic and count
        topics_count = session.query(Question.topic, func.count(Question.id)).group_by(Question.topic).all()
        topics = [{"name": t[0], "count": t[1]} for t in topics_count]
        
        # Test information is dyanmic now, no pre-defined "tests" needed for the frontend index,
        # but the frontend expects a `tests` array to know they exist.
        return {
            "topics": topics,
            "tests": [{"id": "dynamic"}] # Frontend just needs this not to be empty
        }
    finally:
        session.close()

@app.get("/api/topics/{topic_name}")
async def get_topic_questions(topic_name: str, limit: int = 10):
    session = SessionLocal()
    try:
        # Get random sample of questions for a topic
        questions = session.query(Question).filter(Question.topic == topic_name).order_by(func.random()).limit(limit).all()
        if not questions:
            raise HTTPException(status_code=404, detail="Topic not found or empty")
        return [q.to_dict() for q in questions]
    finally:
        session.close()

@app.get("/api/test")
async def get_test(limit: int = 24):
    session = SessionLocal()
    try:
        questions = session.query(Question).order_by(func.random()).limit(limit).all()
        if not questions:
            raise HTTPException(status_code=404, detail="No questions available")
        return [q.to_dict() for q in questions]
    finally:
        session.close()

@app.post("/api/progress/record")
async def record_progress(payload: ProgressRecordPayload):
    session = SessionLocal()
    try:
        new_session = TestSession(
            score=payload.score,
            total_questions=payload.total_questions,
            timestamp=datetime.utcnow()
        )
        session.add(new_session)
        session.flush() # Get the auto-incremented ID
        
        for resp in payload.responses:
            new_resp = UserResponse(
                session_id=new_session.id,
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
async def get_progress_stats():
    session = SessionLocal()
    try:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # 1. Activity Trend: count of questions answered per day over the last 30 days
        activity_query = session.query(
            func.date(UserResponse.timestamp).label("day"),
            func.count(UserResponse.id).label("count")
        ).filter(UserResponse.timestamp >= thirty_days_ago)\
         .group_by(func.date(UserResponse.timestamp))\
         .order_by(func.date(UserResponse.timestamp)).all()
         
        activity_trend = [{"date": r.day, "count": r.count} for r in activity_query]
        
        # 2. Score Trend: average score per day
        score_query = session.query(
            func.date(TestSession.timestamp).label("day"),
            func.avg(TestSession.score).label("avg_score")
        ).filter(TestSession.timestamp >= thirty_days_ago)\
         .group_by(func.date(TestSession.timestamp))\
         .order_by(func.date(TestSession.timestamp)).all()
         
        score_trend = [{"date": r.day, "avg_score": round(r.avg_score, 2)} for r in score_query]
        
        # 3. Topic Performance: percentage correct per topic (all time)
        topic_totals = session.query(
            UserResponse.topic,
            func.count(UserResponse.id).label("total")
        ).group_by(UserResponse.topic).all()
        
        topic_corrects = session.query(
            UserResponse.topic,
            func.count(UserResponse.id).label("correct")
        ).filter(UserResponse.is_correct == True)\
         .group_by(UserResponse.topic).all()
         
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
