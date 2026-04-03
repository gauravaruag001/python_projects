"""
API Integration Tests for the Life in the UK Test application.
Uses an in-memory SQLite database — no changes to the production DB.

Run with:  pytest tests/test_api.py -v
"""
import json
import sys
import os
import pytest

# Make sure the linuk-tester directory is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """Spin up the app against an in-memory SQLite DB seeded with test data."""
    import server as srv

    # StaticPool ensures all connections share the SAME in-memory database
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    srv.Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Patch module-level references
    srv.engine = test_engine
    srv.SessionLocal = TestingSession

    # Seed: one question per topic
    db = TestingSession()
    q1 = srv.Question(
        topic="History",
        question="What year was Magna Carta signed?",
        options=json.dumps(["1215", "1066", "1348", "1588"]),
        correct_answer="1215",
        explanation="Signed in 1215 at Runnymede."
    )
    q2 = srv.Question(
        topic="Government",
        question="What is the name of the UK parliament building?",
        options=json.dumps(["Houses of Parliament", "Buckingham Palace", "10 Downing Street", "The Shard"]),
        correct_answer="Houses of Parliament",
        explanation="Parliament sits in Westminster."
    )
    db.add(q1)
    db.add(q2)
    db.commit()
    db.close()

    with TestClient(srv.app, raise_server_exceptions=False) as c:
        yield c


# ── /api/index ───────────────────────────────────────────────────────────────

def test_get_index_returns_200(client):
    r = client.get("/api/index")
    assert r.status_code == 200


def test_get_index_has_topics(client):
    r = client.get("/api/index")
    data = r.json()
    assert "topics" in data
    assert len(data["topics"]) == 2


def test_get_index_has_tests_key(client):
    r = client.get("/api/index")
    assert "tests" in r.json()


def test_get_index_topic_counts(client):
    r = client.get("/api/index")
    topics = {t["name"]: t["count"] for t in r.json()["topics"]}
    assert topics["History"] == 1
    assert topics["Government"] == 1


# ── /api/topics/{topic_name} ─────────────────────────────────────────────────

def test_get_topic_returns_envelope(client):
    r = client.get("/api/topics/History")
    assert r.status_code == 200
    data = r.json()
    assert "questions" in data
    assert "total" in data
    assert "offset" in data
    assert "limit" in data


def test_get_topic_returns_question_fields(client):
    r = client.get("/api/topics/History")
    q = r.json()["questions"][0]
    assert "id" in q
    assert "question" in q
    assert "options" in q
    assert "correctAnswer" in q
    assert "topic" in q


def test_get_topic_total_count(client):
    r = client.get("/api/topics/History")
    assert r.json()["total"] == 1


def test_get_topic_not_found(client):
    r = client.get("/api/topics/NonExistentTopic")
    assert r.status_code == 404


def test_get_topic_limit_respected(client):
    r = client.get("/api/topics/History?limit=1")
    assert len(r.json()["questions"]) == 1


def test_get_topic_pagination_offset(client):
    r = client.get("/api/topics/History?offset=0&limit=10")
    assert r.status_code == 200
    assert r.json()["offset"] == 0


# ── /api/test ────────────────────────────────────────────────────────────────

def test_get_test_returns_list(client):
    r = client.get("/api/test")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_test_respects_limit(client):
    r = client.get("/api/test?limit=1")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_test_question_fields(client):
    r = client.get("/api/test?limit=1")
    q = r.json()[0]
    assert "id" in q
    assert "question" in q
    assert "options" in q
    assert "correctAnswer" in q


def test_get_test_rate_limited(client):
    """11th request within a minute should return 429."""
    responses = [client.get("/api/test?limit=1") for _ in range(11)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected a 429 after 10 requests, got: {set(status_codes)}"


# ── /api/progress/record ─────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "score": 75.0,
    "total_questions": 24,
    "responses": [
        {"topic": "History", "is_correct": True, "question_id": 1},
        {"topic": "Government", "is_correct": False, "question_id": 2},
    ]
}


def test_record_progress_returns_200(client):
    r = client.post("/api/progress/record", json=VALID_PAYLOAD)
    assert r.status_code == 200


def test_record_progress_returns_session_id(client):
    r = client.post("/api/progress/record", json=VALID_PAYLOAD)
    data = r.json()
    assert data["status"] == "success"
    assert "session_id" in data
    assert isinstance(data["session_id"], int)


def test_record_progress_invalid_payload(client):
    r = client.post("/api/progress/record", json={"bad": "data"})
    assert r.status_code == 422


def test_record_progress_empty_responses(client):
    payload = {"score": 50.0, "total_questions": 24, "responses": []}
    r = client.post("/api/progress/record", json=payload)
    assert r.status_code == 200


# ── /api/progress/stats ──────────────────────────────────────────────────────

def test_get_stats_returns_200(client):
    r = client.get("/api/progress/stats")
    assert r.status_code == 200


def test_get_stats_structure(client):
    r = client.get("/api/progress/stats")
    data = r.json()
    assert "activity_trend" in data
    assert "score_trend" in data
    assert "topic_performance" in data


def test_get_stats_all_time(client):
    r = client.get("/api/progress/stats?period=all")
    assert r.status_code == 200
    data = r.json()
    assert "topic_performance" in data


def test_get_stats_90d(client):
    r = client.get("/api/progress/stats?period=90d")
    assert r.status_code == 200


def test_get_stats_topic_performance_has_fields(client):
    # Record something first so there's data
    client.post("/api/progress/record", json=VALID_PAYLOAD)
    r = client.get("/api/progress/stats?period=all")
    perf = r.json()["topic_performance"]
    if perf:
        assert "topic" in perf[0]
        assert "percentage" in perf[0]
        assert "total_answered" in perf[0]


# ── /api/progress/export ─────────────────────────────────────────────────────

def test_export_csv_returns_200(client):
    r = client.get("/api/progress/export")
    assert r.status_code == 200


def test_export_csv_content_type(client):
    r = client.get("/api/progress/export")
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_has_header_row(client):
    r = client.get("/api/progress/export")
    first_line = r.text.strip().split("\n")[0]
    assert "session_id" in first_line
    assert "score_percent" in first_line


# ── /api/progress/questions ──────────────────────────────────────────────────

def test_get_question_history_returns_200(client):
    r = client.get("/api/progress/questions")
    assert r.status_code == 200


def test_get_question_history_is_list(client):
    r = client.get("/api/progress/questions")
    assert isinstance(r.json(), list)


# ── /api/auth ────────────────────────────────────────────────────────────────

def test_auth_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_auth_register_success(client):
    r = client.post("/api/auth/register", json={"username": "testuser_reg", "pin": "1234"})
    assert r.status_code == 200
    assert r.json()["status"] == "registered"


def test_auth_register_duplicate_username(client):
    client.post("/api/auth/register", json={"username": "testuser_dup", "pin": "1234"})
    r = client.post("/api/auth/register", json={"username": "testuser_dup", "pin": "5678"})
    assert r.status_code == 409


def test_auth_register_bad_pin(client):
    r = client.post("/api/auth/register", json={"username": "testuser_badpin", "pin": "abc"})
    assert r.status_code == 400


def test_auth_login_success(client):
    client.post("/api/auth/register", json={"username": "testuser_login", "pin": "4321"})
    r = client.post("/api/auth/login", json={"username": "testuser_login", "pin": "4321"})
    assert r.status_code == 200
    assert r.json()["status"] == "logged_in"


def test_auth_login_wrong_pin(client):
    client.post("/api/auth/register", json={"username": "testuser_wrongpin", "pin": "9999"})
    r = client.post("/api/auth/login", json={"username": "testuser_wrongpin", "pin": "0000"})
    assert r.status_code == 401


def test_auth_logout(client):
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    assert r.json()["status"] == "logged_out"
