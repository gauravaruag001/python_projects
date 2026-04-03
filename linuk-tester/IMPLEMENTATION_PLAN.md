# Implementation Plan — Life in UK Test App

---

## Phase 1 — Critical Bug Fixes
*No dependencies. Do these first.*

### A1 — Fix CSS Corruption in `style.css:362-374`
**Complexity: Low**

The characters are space-separated (encoding corruption). Replace lines 362–374 with:
```css
/* Progress Dashboard Styles */
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}
.chart-wrapper {
    position: relative;
    height: 350px;
    width: 100%;
}
```
Also remove the redundant inline `style="position: relative; height: 300px..."` from the chart-wrapper divs in `index.html:127-141`.

---

### A3 — Remove Non-Existent Cache Entry from `sw.js:7`
**Complexity: Low**

`cache.addAll()` is **atomic** — one bad URL breaks the entire service worker install. Remove `'./db/index.json'` from the ASSETS array, and bump `CACHE_NAME` to `linuk-cache-v7` to force existing clients to update.

---

### A2 — Add Missing PWA Icons
**Complexity: Low**

- Create `/linuk-tester/assets/` folder
- Generate `icon-192.png` (192×192) and `icon-512.png` (512×512) — simple indigo `#4f46e5` background with "UK" text using Pillow
- Mount the folder as static files in `server.py`:
```python
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
```

---

## Phase 2 — Configuration Centralisation
*Independent of all other phases. Establishes constants used everywhere else.*

### C1 — Extract Hardcoded Constants
**Complexity: Low**

**`app.js`** — add a `CONFIG` object at the top:
```js
const CONFIG = {
    TEST_QUESTION_COUNT: 24,
    TEST_DURATION_SECONDS: 45 * 60,
    TEST_PASS_MARK: 18,
};
```
Replace all magic numbers referencing these values throughout the file (~6 locations).

**`server.py`** — add a config block after imports:
```python
TEST_QUESTION_COUNT = 24
TEST_DURATION_MINUTES = 45
TEST_PASS_MARK = 18
STATS_LOOKBACK_DAYS = 30
```
Replace hardcoded defaults in `get_test()` and `get_progress_stats()`.

---

### C2 — Fix Hardcoded Path in `generate_questions.py:19`
**Complexity: Low**

Replace the hardcoded `PDF_PATH = r"c:\Users\44743\..."` with `argparse` + environment variable fallback:
```python
parser.add_argument("--pdf", default=os.getenv("LINUK_PDF_PATH"))
parser.add_argument("--output", default=os.getenv("LINUK_OUTPUT_FILE", r"db\local_questions.json"))
```
Exit with a clear error if no PDF path is provided.

---

## Phase 3 — Database Improvements
*Do after Phase 2 (consistent constants established).*

### D1 — Add Index on `topic` Column
**Complexity: Low**

- Add `index=True` to the `topic` column in the `Question` model in `server.py`
- Add a startup handler to create the index on the **existing** database (since `create_all` won't alter existing tables):
```python
@app.on_event("startup")
async def ensure_indexes():
    with engine.connect() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_questions_topic ON questions (topic)"))
        conn.commit()
```

---

### D2 — Add Pagination to `/api/topics/{topic}`
**Complexity: Low**

**`server.py`** — add `offset: int = 0` parameter. When `offset > 0`, use `ORDER BY id` (stable) instead of `ORDER BY RANDOM()`. Return a pagination envelope:
```python
return { "questions": [...], "total": N, "offset": offset, "limit": limit }
```
**`app.js`** — update `startFlashcards()` to read `response.questions` instead of expecting a bare array.

---

## Phase 4 — Authentication & Rate Limiting
*B2 (auth) must come before B1 (rate limiting needs a user identity).*

### B2 — Lightweight User Authentication
**Complexity: Medium**

**New file**: `/linuk-tester/auth.py` — `get_current_user()` FastAPI dependency that validates session cookies.

**`server.py`** — add two new DB models:
```python
class User(Base):
    __tablename__ = 'users'
    id, username, pin_hash, created_at

class UserSession(Base):
    __tablename__ = 'user_sessions'
    id, user_id, token, created_at, expires_at
```
Add `user_id` (nullable for migration) to `TestSession` and `UserResponse`.

Add 4 new endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

PIN hashing: use `hashlib.pbkdf2_hmac` (no extra library). Token stored in an `HttpOnly` cookie.

**`index.html` + `app.js`** — on `DOMContentLoaded`, call `GET /api/auth/me`; if 401, show a login/register modal. The cookie is sent automatically with all same-origin `fetch()` calls.

**`requirements.txt`** — add `python-multipart`.

---

### B1 — Rate Limiting on `/api/test`
**Complexity: Low**

**`requirements.txt`** — add `slowapi`.

**`server.py`**:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/test")
@limiter.limit("10/minute")
async def get_test(request: Request, ...):
```
Once B2 is in place, switch `key_func` to read `user_id` from the session cookie for per-user (not per-IP) limits.

---

## Phase 5 — Flashcard Enhancements
*Independent of Phase 4. E2 must come before E3.*

### E2 — Mark as Learned
**Complexity: Low**

- localStorage key `linuk_learned` stores a JSON array of learned question IDs
- Add helpers `getLearnedIds()`, `markLearned(id)`, `unmarkLearned(id)` to `app.js`
- Filter out learned cards when loading flashcards (with fallback if all are learned)
- Add a "Mark as Learned" toggle button to the flashcard screen in `index.html`; button turns green and shows "Learned ✓" when active
- Update `updateFlashcardUI()` to refresh the button state on navigation

---

### E3 — Spaced Repetition
**Complexity: Medium**

localStorage key `linuk_sr` stores `{ [questionId]: { correct, incorrect, nextReview } }`.

**Algorithm** (simplified SM-2):
- Correct answer: `nextReview = today + 2^correct days` (exponential back-off)
- Incorrect answer: `nextReview = null` (show again immediately)
- Card ordering: sort by `incorrect / (correct + incorrect + 1)` — hardest cards first
- Skip cards where `nextReview` is in the future

**`index.html`** — add "Got it" / "Missed it" buttons (shown only on the card back):
```html
<button onclick="recordAnswer(true)">Got it</button>
<button onclick="recordAnswer(false)">Missed it</button>
```
`recordAnswer()` in `app.js` calls `recordSRResult()` then auto-advances.

---

## Phase 6 — Progress Dashboard Enhancements
*G3 schema change first, then G1 and G2 (which are independent of each other).*

### G3 — Per-Question History
**Complexity: Medium**

**`server.py`** — add `question_id` (nullable FK to `questions.id`) to the `UserResponse` model and the `QuestionResponseItem` Pydantic schema.

Add new endpoint `GET /api/progress/questions` returning each question with its attempt count and correct count.

**`app.js`** — in `finishTest()`, add `question_id: q.id` to each response object in the payload.

**Migration**: `question_id` is nullable so existing rows are unaffected. Run once on the existing DB:
```sql
ALTER TABLE user_responses ADD COLUMN question_id INTEGER REFERENCES questions(id);
```

---

### G1 — All-Time Stats View
**Complexity: Low**

**`server.py`** — add `period: str = "30d"` query param to `GET /api/progress/stats`. When `period == "all"`, remove the date filter.

**`index.html`** — add a dropdown to the progress screen:
```html
<select id="stats-period" onchange="showProgressDashboard()">
    <option value="30d">Last 30 Days</option>
    <option value="90d">Last 90 Days</option>
    <option value="all">All Time</option>
</select>
```

**`app.js`** — read the selected period and pass it as a query param when fetching stats.

---

### G2 — Progress Data Export (CSV)
**Complexity: Low**

**`server.py`** — add `GET /api/progress/export` returning a `StreamingResponse` with `Content-Type: text/csv` and `Content-Disposition: attachment; filename=progress_export.csv`.

**`index.html`** — add an "Export CSV" button on the progress screen.

**`app.js`** — `exportProgressCSV()` creates a temporary `<a href="/api/progress/export">` and clicks it; the browser handles the download natively.

---

## Phase 7 — Backend Tests
*Do after all endpoints are finalised.*

### H1 — pytest API Tests
**Complexity: Medium**

**New files**:
- `/linuk-tester/tests/__init__.py`
- `/linuk-tester/tests/test_api.py`

**`requirements.txt`** — add `pytest>=8.0.0`, `httpx>=0.27.0`.

Tests use `fastapi.testclient.TestClient` with an in-memory SQLite DB (`sqlite:///:memory:`) seeded with fixture data. The `SessionLocal` in `server.py` is overridden via a dependency injection override.

| Test | Endpoint | Asserts |
|---|---|---|
| `test_get_index_returns_topics` | GET /api/index | Topics list present |
| `test_get_topic_questions_valid` | GET /api/topics/X | Returns question objects |
| `test_get_topic_questions_not_found` | GET /api/topics/X | 404 |
| `test_get_topic_pagination` | GET /api/topics/X?offset=0 | Returns envelope |
| `test_get_test_returns_questions` | GET /api/test | Correct count |
| `test_get_test_rate_limited` | GET /api/test (11 calls) | 429 on 11th |
| `test_record_progress_valid` | POST /api/progress/record | 200 + session_id |
| `test_record_progress_invalid` | POST /api/progress/record (bad JSON) | 422 |
| `test_get_stats_structure` | GET /api/progress/stats | Has activity_trend, score_trend, topic_performance |
| `test_get_stats_all_time` | GET /api/progress/stats?period=all | No date filter applied |
| `test_export_csv` | GET /api/progress/export | Content-Type text/csv, header row correct |
| `test_auth_register` | POST /api/auth/register | 200 + cookie set |
| `test_auth_login_invalid_pin` | POST /api/auth/login | 401 |
| `test_auth_me_unauthenticated` | GET /api/auth/me | 401 |

---

## Phase 8 — Polish
*Can be done at any time, but H4 must be last.*

### H2 — Improve Frontend Error Messages
**Complexity: Low**

Replace all `alert()` calls in `app.js` with an in-page `showError()` function that renders a dismissing error banner inside the current screen (not a blocking popup). Update `fetchFromAPI()` to extract `response.detail` from the JSON body for specific server error messages and distinguish network failures (`TypeError`) from HTTP errors.

Add a `.error-banner` style to `style.css`.

---

### H4 — Update ARCHITECTURE.md
**Complexity: Low**

Rewrite `ARCHITECTURE.md` after all changes are complete to document:
- Updated tech stack (slowapi, pytest, httpx, python-multipart)
- All 5 DB tables with schema (questions, test_sessions, user_responses, users, user_sessions)
- User auth flow (PIN hashing approach, session cookie)
- CONFIG object in `app.js` and server.py constants
- localStorage schema for spaced repetition (`linuk_learned`, `linuk_sr`)
- How to run tests (`pytest tests/`)
- Remove all references to the old decryption logic and `db/index.json`

---

## Summary

| Phase | Items | Complexity |
|---|---|---|
| 1 — Bug Fixes | A1, A3, A2 | All Low |
| 2 — Config | C1, C2 | All Low |
| 3 — Database | D1, D2 | All Low |
| 4 — Auth & Rate Limiting | B2, B1 | Medium, Low |
| 5 — Flashcards | E2, E3 | Low, Medium |
| 6 — Progress Dashboard | G3, G1, G2 | Medium, Low, Low |
| 7 — Tests | H1 | Medium |
| 8 — Polish | H2, H4 | All Low |

**New files to be created**: `assets/icon-192.png`, `assets/icon-512.png`, `auth.py`, `tests/__init__.py`, `tests/test_api.py`
