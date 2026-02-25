import json
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, Text, func
from sqlalchemy.orm import declarative_base, sessionmaker
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

