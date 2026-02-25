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
    timeRemaining: 45 * 60, // 45 minutes in seconds
};

// DOM Elements
const screens = {
    'home': document.getElementById('home-screen'),
    'topic-selection': document.getElementById('topic-selection-screen'),
    'flashcard': document.getElementById('flashcard-screen'),
    'test': document.getElementById('test-screen'),
    'results': document.getElementById('results-screen'),
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    console.log("App initialized");
});

// Removed decryption logic as the backend handles data securely now.
async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP error fetching ${endpoint}: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

async function loadDatabase() {
    try {
        console.log(`Loading index from API...`);
        window.quizIndex = await fetchFromAPI('/api/index');
        console.log(`Loaded index successfully from backend APIs.`);

        // Re-render topic list if on topic selection screen
        if (state.currentScreen === 'topic-selection') {
            renderTopicList();
        }
    } catch (error) {
        console.error("Failed to load backend index:", error);
        alert("Failed to securely connect to the backend server. Please check your connection.");
    }
}

function showScreen(screenName) {
    if (screenName === 'home' || screenName === 'topic-selection') {
        // Aggressively clear unencrypted questions from memory when leaving a session
        state.fcQuestions = [];
        state.testQuestions = [];
    }

    // Hide all screens
    Object.values(screens).forEach(el => {
        el.classList.remove('active', 'hidden');
        el.style.display = 'none';
    });

    // Show target screen
    const target = screens[screenName];
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);
    state.currentScreen = screenName;

    // Specific screen setup
    if (screenName === 'topic-selection') renderTopicList();
}

// --- Logic: Randomizer ---

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Feature: Flashcards ---

function renderTopicList() {
    const topicList = document.getElementById('topic-list');
    topicList.innerHTML = '';

    if (!window.quizIndex || !window.quizIndex.topics) {
        console.error("Quiz index not loaded!");
        topicList.innerHTML = '<p>Error loading index. Please refresh the page.</p>';
        return;
    }

    const topics = window.quizIndex.topics;
    console.log(`Rendered topics: ${topics.map(t => t.name).join(', ')}`);

    topics.forEach(topic => {
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
    console.log(`Starting flashcards for topic: ${topicObj.name}`);

    try {
        const pool = await fetchFromAPI(`/api/topics/${encodeURIComponent(topicObj.name)}?limit=10`);

        if (pool.length === 0) {
            console.error(`No questions found for topic: ${topicObj.name}`);
            alert("No questions available for this topic.");
            return;
        }

        state.fcQuestions = pool; // Already randomized by backend
        state.fcIndex = 0;
        state.fcFlipped = false;

        updateFlashcardUI();
        showScreen('flashcard');
    } catch (err) {
        console.error("Failed to fetch topic:", err);
        alert("Failed to securely get questions from the server.");
    }
}

function updateFlashcardUI() {
    const q = state.fcQuestions[state.fcIndex];
    if (!q) return;

    document.getElementById('flashcard-topic-title').textContent = state.fcTopic;
    document.getElementById('flashcard-counter').textContent = `${state.fcIndex + 1} / ${state.fcQuestions.length}`;

    // Always show front when navigating to a new card
    document.getElementById('fc-front').style.display = 'flex';
    document.getElementById('fc-back').style.display = 'none';
    state.fcFlipped = false;

    document.getElementById('fc-question').textContent = q.question;
    document.getElementById('fc-answer').textContent = q.correctAnswer;
    document.getElementById('fc-explanation').textContent = q.explanation || "";
}

function flipCard() {
    const front = document.getElementById('fc-front');
    const back = document.getElementById('fc-back');
    if (state.fcFlipped) {
        front.style.display = 'flex';
        back.style.display = 'none';
    } else {
        front.style.display = 'none';
        back.style.display = 'flex';
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

window.flipCard = flipCard;
window.nextCard = nextCard;
window.prevCard = prevCard;

// --- Feature: Test Engine ---

async function startTest() {
    state.mode = 'test';

    try {
        console.log(`Fetching random mock test from API...`);
        const selectedQuestions = await fetchFromAPI('/api/test?limit=24');

        if (!selectedQuestions || selectedQuestions.length === 0) {
            alert("Failed to fetch questions for mock test.");
            return;
        }

        // Deep clone and shuffle options for each question so original data isn't modified
        state.testQuestions = selectedQuestions.map(q => ({
            ...q,
            options: shuffleArray([...q.options])
        }));

        state.testAnswers = {};
        state.testIndex = 0;
        state.timeRemaining = 45 * 60;

        startTimer();
        updateTestUI();
        showScreen('test');
    } catch (err) {
        console.error("Test fetch failed:", err);
        alert("Failed to securely load the test from the server.");
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

    // Progress Bar
    const pct = ((state.testIndex) / total) * 100;
    document.getElementById('test-progress').style.width = `${pct}%`;

    // Question
    document.getElementById('test-question-text').textContent = `${state.testIndex + 1}. ${q.question}`;

    // Options
    const optionsContainer = document.getElementById('test-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('div');
        btn.className = 'option-btn';
        if (state.testAnswers[q.id] === idx) {
            btn.classList.add('selected');
        }
        btn.textContent = opt;
        btn.onclick = () => selectOption(q.id, idx);
        optionsContainer.appendChild(btn);
    });

    // Button Text
    const nextBtn = document.getElementById('next-test-btn');
    nextBtn.textContent = (state.testIndex === total - 1) ? 'Finish Test' : 'Next';
}

function selectOption(qId, idx) {
    state.testAnswers[qId] = idx;
    updateTestUI(); // Re-render to show selection state
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
    const breakdown = {}; // { topic: { total, correct } }

    state.testQuestions.forEach(q => {
        const selectedIdx = state.testAnswers[q.id];
        const selectedOpt = q.options[selectedIdx];
        const isCorrect = selectedOpt === q.correctAnswer;

        if (isCorrect) score++;

        // Track topic performance
        if (!breakdown[q.topic]) breakdown[q.topic] = { total: 0, correct: 0 };
        breakdown[q.topic].total++;
        if (isCorrect) breakdown[q.topic].correct++;
    });

    // Render Results
    const passingScore = 18; // 75% of 24
    const isPass = score >= passingScore;

    document.getElementById('result-title').textContent = isPass ? '🎉 Passed!' : 'Requires Improvement';
    document.getElementById('result-title').style.color = isPass ? '#10b981' : '#ef4444';

    document.getElementById('score-percentage').textContent = `${Math.round((score / 24) * 100)}%`;
    document.getElementById('score-fraction').textContent = `${score} / 24`;

    const breakdownList = document.getElementById('topic-breakdown');
    breakdownList.innerHTML = '';

    Object.keys(breakdown).forEach(topic => {
        const data = breakdown[topic];
        const pct = Math.round((data.correct / data.total) * 100);
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <span>${topic}</span>
            <span>${data.correct}/${data.total} (${pct}%)</span>
        `;
        breakdownList.appendChild(item);
    });

    showScreen('results');
}

// Global Exports
window.startTest = startTest;
window.nextTestQuestion = nextTestQuestion;
window.showScreen = showScreen;
window.startFlashcards = startFlashcards;
