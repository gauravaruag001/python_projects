// Application Configuration
const CONFIG = {
    TEST_QUESTION_COUNT: 24,
    TEST_DURATION_SECONDS: 45 * 60,
    TEST_PASS_MARK: 18,
};

// State Management
const state = {
    currentScreen: 'home',
    mode: null, // 'flashcards' or 'test'
    // Flashcard State
    fcTopic: null,
    fcQuestions: [],
    fcIndex: 0,
    fcFlipped: false,
    // Test State
    testQuestions: [],
    testAnswers: {}, // { questionId: selectedOptionIndex }
    testIndex: 0,
    timerInterval: null,
    timeRemaining: CONFIG.TEST_DURATION_SECONDS,
    // Auth State
    currentUser: null,
};

// DOM Elements
const screens = {
    'home': document.getElementById('home-screen'),
    'topic-selection': document.getElementById('topic-selection-screen'),
    'flashcard': document.getElementById('flashcard-screen'),
    'test': document.getElementById('test-screen'),
    'results': document.getElementById('results-screen'),
    'progress-screen': document.getElementById('progress-screen'),
};

// --- Error Handling ---

function showError(message, containerId = null) {
    const el = document.createElement('div');
    el.className = 'error-banner';
    el.textContent = message;
    const container = (containerId && document.getElementById(containerId))
        || document.getElementById('main-container');
    if (container) container.prepend(el);
    setTimeout(() => el.remove(), 6000);
}

// --- API Helper ---

async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            let detail = `Server error (${response.status})`;
            try {
                const body = await response.json();
                if (body.detail) detail = body.detail;
            } catch (_) {}
            throw new Error(detail);
        }
        return await response.json();
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error("Cannot reach the server. Check that the backend is running.");
        }
        throw error;
    }
}

// --- Auth ---

async function checkAuth() {
    try {
        const data = await fetchFromAPI('/api/auth/me');
        state.currentUser = data;
        updateNavUser();
    } catch (_) {
        // Not logged in — show modal
        showAuthModal();
    }
}

function updateNavUser() {
    const el = document.getElementById('nav-username');
    if (el && state.currentUser) {
        el.textContent = state.currentUser.username;
    }
}

function showAuthModal() {
    const existing = document.getElementById('auth-modal');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-modal';
    overlay.className = 'auth-modal-overlay';
    overlay.innerHTML = `
        <div class="auth-modal-box">
            <h2>🇬🇧 Life in the UK</h2>
            <div id="auth-error" class="error-banner" style="display:none;"></div>
            <div class="auth-input-group">
                <label>Username</label>
                <input id="auth-username" type="text" placeholder="Enter username" maxlength="30" autocomplete="username"/>
            </div>
            <div class="auth-input-group">
                <label>4-digit PIN</label>
                <input id="auth-pin" type="password" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="current-password"/>
            </div>
            <div class="auth-btn-row">
                <button class="control-btn" onclick="submitAuth('login')">Login</button>
                <button class="control-btn" onclick="submitAuth('register')" style="background:#10b981;">Register</button>
            </div>
            <div class="auth-guest-link" onclick="continueAsGuest()">Continue as guest</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Allow Enter key to trigger login
    overlay.querySelector('#auth-pin').addEventListener('keydown', e => {
        if (e.key === 'Enter') submitAuth('login');
    });
}

async function submitAuth(mode) {
    const username = document.getElementById('auth-username')?.value.trim();
    const pin = document.getElementById('auth-pin')?.value.trim();
    const errorEl = document.getElementById('auth-error');

    if (!username || !pin) {
        if (errorEl) { errorEl.textContent = 'Please enter both username and PIN.'; errorEl.style.display = 'block'; }
        return;
    }

    try {
        const data = await fetch(`/api/auth/${mode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });
        const result = await data.json();
        if (!data.ok) {
            if (errorEl) { errorEl.textContent = result.detail || 'Authentication failed.'; errorEl.style.display = 'block'; }
            return;
        }
        state.currentUser = { username: result.username };
        document.getElementById('auth-modal')?.remove();
        updateNavUser();
        console.log(`Logged in as ${result.username}`);
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Network error. Is the server running?'; errorEl.style.display = 'block'; }
    }
}

function continueAsGuest() {
    document.getElementById('auth-modal')?.remove();
    state.currentUser = null;
    console.log('Continuing as guest');
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    state.currentUser = null;
    const el = document.getElementById('nav-username');
    if (el) el.textContent = '';
    showAuthModal();
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    await checkAuth();
    console.log("App initialized");
});

async function loadDatabase() {
    try {
        window.quizIndex = await fetchFromAPI('/api/index');
        if (state.currentScreen === 'topic-selection') renderTopicList();
    } catch (error) {
        showError("Could not connect to the backend server: " + error.message);
    }
}

function showScreen(screenName) {
    if (screenName === 'home' || screenName === 'topic-selection') {
        state.fcQuestions = [];
        state.testQuestions = [];
    }

    Object.values(screens).forEach(el => {
        if (el) {
            el.classList.remove('active', 'hidden');
            el.style.display = 'none';
        }
    });

    const target = screens[screenName];
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    state.currentScreen = screenName;

    if (screenName === 'topic-selection') renderTopicList();
}

// --- Randomizer ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Spaced Repetition Helpers ---

function getLearnedIds() {
    return new Set(JSON.parse(localStorage.getItem('linuk_learned') || '[]'));
}

function markLearned(questionId) {
    const learned = getLearnedIds();
    learned.add(questionId);
    localStorage.setItem('linuk_learned', JSON.stringify([...learned]));
}

function unmarkLearned(questionId) {
    const learned = getLearnedIds();
    learned.delete(questionId);
    localStorage.setItem('linuk_learned', JSON.stringify([...learned]));
}

function getSRData() {
    return JSON.parse(localStorage.getItem('linuk_sr') || '{}');
}

function recordSRResult(questionId, wasCorrect) {
    const data = getSRData();
    if (!data[questionId]) data[questionId] = { correct: 0, incorrect: 0, nextReview: null };
    if (wasCorrect) {
        data[questionId].correct++;
        const interval = Math.pow(2, data[questionId].correct);
        const next = new Date();
        next.setDate(next.getDate() + interval);
        data[questionId].nextReview = next.toISOString();
    } else {
        data[questionId].incorrect++;
        data[questionId].nextReview = null;
    }
    localStorage.setItem('linuk_sr', JSON.stringify(data));
}

function weightedSort(questions) {
    const sr = getSRData();
    const now = new Date();
    const due = questions.filter(q => {
        const d = sr[q.id];
        if (!d || !d.nextReview) return true;
        return new Date(d.nextReview) <= now;
    });
    due.sort((a, b) => {
        const da = sr[a.id] || { correct: 0, incorrect: 0 };
        const db = sr[b.id] || { correct: 0, incorrect: 0 };
        const scoreA = da.incorrect / (da.correct + da.incorrect + 1);
        const scoreB = db.incorrect / (db.correct + db.incorrect + 1);
        return scoreB - scoreA;
    });
    return due.length > 0 ? due : questions;
}

// --- Flashcards ---

function renderTopicList() {
    const topicList = document.getElementById('topic-list');
    topicList.innerHTML = '';

    if (!window.quizIndex || !window.quizIndex.topics) {
        topicList.innerHTML = '<p>Error loading topics. Please refresh the page.</p>';
        return;
    }

    window.quizIndex.topics.forEach(topic => {
        const btn = document.createElement('div');
        btn.className = 'topic-btn card';
        btn.innerHTML = `
            <strong>${topic.name}</strong>
            <br><span style="font-size:0.8em; color:#666">${topic.count} questions</span>
        `;
        btn.onclick = () => startFlashcards(topic);
        topicList.appendChild(btn);
    });
}

async function startFlashcards(topicObj) {
    state.mode = 'flashcards';
    state.fcTopic = topicObj.name;

    try {
        const response = await fetchFromAPI(`/api/topics/${encodeURIComponent(topicObj.name)}?limit=10`);
        const pool = response.questions || [];

        if (pool.length === 0) {
            showError(`No questions available for "${topicObj.name}".`);
            return;
        }

        // Filter learned cards, fall back to full pool if all are learned
        const learned = getLearnedIds();
        const unlearned = pool.filter(q => !learned.has(q.id));
        const basePool = unlearned.length > 0 ? unlearned : pool;

        if (unlearned.length === 0 && pool.length > 0) {
            showError(`All cards in "${topicObj.name}" are marked as learned! Showing all cards.`);
        }

        // Apply spaced repetition ordering
        state.fcQuestions = weightedSort(basePool);
        state.fcIndex = 0;
        state.fcFlipped = false;

        updateFlashcardUI();
        showScreen('flashcard');
    } catch (err) {
        showError(`Could not load flashcards for "${topicObj.name}": ${err.message}`);
    }
}

function updateFlashcardUI() {
    const q = state.fcQuestions[state.fcIndex];
    if (!q) return;

    document.getElementById('flashcard-topic-title').textContent = state.fcTopic;
    document.getElementById('flashcard-counter').textContent = `${state.fcIndex + 1} / ${state.fcQuestions.length}`;

    document.getElementById('fc-front').style.display = 'flex';
    document.getElementById('fc-back').style.display = 'none';
    state.fcFlipped = false;

    document.getElementById('fc-question').textContent = q.question;
    document.getElementById('fc-answer').textContent = q.correctAnswer;
    document.getElementById('fc-explanation').textContent = q.explanation || "";

    // SR controls hidden until card is flipped
    const srControls = document.getElementById('sr-controls');
    if (srControls) srControls.style.display = 'none';

    // Update Mark as Learned button
    const learnBtn = document.getElementById('mark-learned-btn');
    if (learnBtn) {
        const isLearned = getLearnedIds().has(q.id);
        learnBtn.textContent = isLearned ? 'Learned ✓' : 'Mark as Learned';
        learnBtn.classList.toggle('learned', isLearned);
    }
}

function flipCard() {
    const front = document.getElementById('fc-front');
    const back = document.getElementById('fc-back');
    const srControls = document.getElementById('sr-controls');
    if (state.fcFlipped) {
        front.style.display = 'flex';
        back.style.display = 'none';
        if (srControls) srControls.style.display = 'none';
    } else {
        front.style.display = 'none';
        back.style.display = 'flex';
        if (srControls) srControls.style.display = 'flex';
    }
    state.fcFlipped = !state.fcFlipped;
}

function nextCard() {
    if (state.fcIndex < state.fcQuestions.length - 1) {
        state.fcIndex++;
        updateFlashcardUI();
    }
}

function prevCard() {
    if (state.fcIndex > 0) {
        state.fcIndex--;
        updateFlashcardUI();
    }
}

function toggleLearned() {
    const q = state.fcQuestions[state.fcIndex];
    if (!q) return;
    const isLearned = getLearnedIds().has(q.id);
    if (isLearned) {
        unmarkLearned(q.id);
    } else {
        markLearned(q.id);
    }
    updateFlashcardUI();
}

function recordAnswer(wasCorrect) {
    const q = state.fcQuestions[state.fcIndex];
    if (!q) return;
    recordSRResult(q.id, wasCorrect);
    // Auto-advance to next card
    if (state.fcIndex < state.fcQuestions.length - 1) {
        state.fcIndex++;
    }
    updateFlashcardUI();
}

window.flipCard = flipCard;
window.nextCard = nextCard;
window.prevCard = prevCard;
window.toggleLearned = toggleLearned;
window.recordAnswer = recordAnswer;

// --- Test Engine ---

async function startTest() {
    state.mode = 'test';

    try {
        const selectedQuestions = await fetchFromAPI(`/api/test?limit=${CONFIG.TEST_QUESTION_COUNT}`);

        if (!selectedQuestions || selectedQuestions.length === 0) {
            showError("No questions available for the mock test.");
            return;
        }

        state.testQuestions = selectedQuestions.map(q => ({
            ...q,
            options: shuffleArray([...q.options])
        }));

        state.testAnswers = {};
        state.testIndex = 0;
        state.timeRemaining = CONFIG.TEST_DURATION_SECONDS;

        startTimer();
        updateTestUI();
        showScreen('test');
    } catch (err) {
        showError("Could not start the test: " + err.message);
    }
}

function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    const timerEl = document.getElementById('timer');

    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        if (state.timeRemaining <= 0) {
            finishTest();
        }

        const mins = Math.floor(state.timeRemaining / 60);
        const secs = state.timeRemaining % 60;
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function updateTestUI() {
    const q = state.testQuestions[state.testIndex];
    const total = state.testQuestions.length;

    const pct = (state.testIndex / total) * 100;
    document.getElementById('test-progress').style.width = `${pct}%`;

    document.getElementById('test-question-text').textContent = `${state.testIndex + 1}. ${q.question}`;

    const optionsContainer = document.getElementById('test-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('div');
        btn.className = 'option-btn';
        if (state.testAnswers[q.id] === idx) btn.classList.add('selected');
        btn.textContent = opt;
        btn.onclick = () => selectOption(q.id, idx);
        optionsContainer.appendChild(btn);
    });

    const nextBtn = document.getElementById('next-test-btn');
    nextBtn.textContent = (state.testIndex === total - 1) ? 'Finish Test' : 'Next';
}

function selectOption(qId, idx) {
    state.testAnswers[qId] = idx;
    updateTestUI();
}

function nextTestQuestion() {
    if (state.testIndex < state.testQuestions.length - 1) {
        state.testIndex++;
        updateTestUI();
    } else {
        finishTest();
    }
}

function finishTest() {
    clearInterval(state.timerInterval);

    let score = 0;
    const breakdown = {};
    const responses = [];

    state.testQuestions.forEach(q => {
        const selectedIdx = state.testAnswers[q.id];
        const selectedOpt = selectedIdx !== undefined ? q.options[selectedIdx] : null;
        const isCorrect = selectedOpt === q.correctAnswer;

        if (isCorrect) score++;
        responses.push({
            topic: q.topic,
            is_correct: isCorrect,
            question_id: q.id
        });

        if (!breakdown[q.topic]) breakdown[q.topic] = { total: 0, correct: 0 };
        breakdown[q.topic].total++;
        if (isCorrect) breakdown[q.topic].correct++;
    });

    if (responses.length > 0) {
        fetch('/api/progress/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: (score / state.testQuestions.length) * 100,
                total_questions: state.testQuestions.length,
                responses: responses
            })
        }).catch(err => console.error("Failed to sync progress:", err));
    }

    const passingScore = CONFIG.TEST_PASS_MARK;
    const isPass = score >= passingScore;

    document.getElementById('result-title').textContent = isPass ? '🎉 Passed!' : 'Requires Improvement';
    document.getElementById('result-title').style.color = isPass ? '#10b981' : '#ef4444';

    document.getElementById('score-percentage').textContent =
        `${Math.round((score / CONFIG.TEST_QUESTION_COUNT) * 100)}%`;
    document.getElementById('score-fraction').textContent =
        `${score} / ${CONFIG.TEST_QUESTION_COUNT}`;

    const breakdownList = document.getElementById('topic-breakdown');
    breakdownList.innerHTML = '';

    Object.keys(breakdown).forEach(topic => {
        const data = breakdown[topic];
        const pct = Math.round((data.correct / data.total) * 100);
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `<span>${topic}</span><span>${data.correct}/${data.total} (${pct}%)</span>`;
        breakdownList.appendChild(item);
    });

    showScreen('results');
}

// --- Progress Dashboard ---

let activityChartInst = null;
let scoreChartInst = null;
let topicChartInst = null;

async function showProgressDashboard() {
    showScreen('progress-screen');

    const period = document.getElementById('stats-period')?.value || '30d';

    try {
        const stats = await fetchFromAPI(`/api/progress/stats?period=${period}`);

        // Activity Chart
        const actCtx = document.getElementById('activityChart').getContext('2d');
        if (activityChartInst) activityChartInst.destroy();
        activityChartInst = new Chart(actCtx, {
            type: 'bar',
            data: {
                labels: stats.activity_trend.map(d => d.date),
                datasets: [{ label: 'Questions Answered', data: stats.activity_trend.map(d => d.count), backgroundColor: '#4f46e5' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Score Chart
        const scoreCtx = document.getElementById('scoreChart').getContext('2d');
        if (scoreChartInst) scoreChartInst.destroy();
        scoreChartInst = new Chart(scoreCtx, {
            type: 'line',
            data: {
                labels: stats.score_trend.map(d => d.date),
                datasets: [{ label: 'Average Score (%)', data: stats.score_trend.map(d => d.avg_score), borderColor: '#10b981', fill: false, tension: 0.1 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
        });

        // Topic Chart
        const topicCtx = document.getElementById('topicChart').getContext('2d');
        if (topicChartInst) topicChartInst.destroy();
        topicChartInst = new Chart(topicCtx, {
            type: 'radar',
            data: {
                labels: stats.topic_performance.map(t => t.topic),
                datasets: [{ label: 'Correct (%)', data: stats.topic_performance.map(t => t.percentage), backgroundColor: 'rgba(236, 72, 153, 0.2)', borderColor: '#ec4899', pointBackgroundColor: '#ec4899' }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
        });

    } catch (err) {
        if (state.currentScreen === 'progress-screen') {
            showError(`Could not load stats. Complete a test first, or check the server. (${err.message})`);
        }
    }
}

async function exportProgressCSV() {
    const link = document.createElement('a');
    link.href = '/api/progress/export';
    link.download = 'progress_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Global Exports ---
window.startTest = startTest;
window.nextTestQuestion = nextTestQuestion;
window.showScreen = showScreen;
window.startFlashcards = startFlashcards;
window.showProgressDashboard = showProgressDashboard;
window.exportProgressCSV = exportProgressCSV;
window.submitAuth = submitAuth;
window.continueAsGuest = continueAsGuest;
window.logout = logout;
