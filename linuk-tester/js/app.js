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
    home: document.getElementById('home-screen'),
    topicSelection: document.getElementById('topic-selection-screen'),
    flashcard: document.getElementById('flashcard-screen'),
    test: document.getElementById('test-screen'),
    results: document.getElementById('results-screen'),
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // initHome(); // Home screen is active by default in HTML
    console.log("App initialized");
});

function showScreen(screenName) {
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

    // Extract unique topics
    if (!window.quizData || window.quizData.length === 0) {
        console.error("Quiz data not loaded!");
        topicList.innerHTML = '<p>Error loading questions. Please refresh the page.</p>';
        return;
    }
    const topics = [...new Set(window.quizData.map(q => q.topic))];
    console.log(`Rendered topics: ${topics.join(', ')}`);

    topics.forEach(topic => {
        const btn = document.createElement('div');
        btn.className = 'topic-btn card';
        btn.innerHTML = `
            <strong>${topic}</strong>
            <br><span style="font-size:0.8em; color:#666">${window.quizData.filter(q => q.topic === topic).length} questions</span>
        `;
        btn.onclick = () => startFlashcards(topic);
        topicList.appendChild(btn);
    });
}

function startFlashcards(topic) {
    state.mode = 'flashcards';
    state.fcTopic = topic;
    console.log(`Starting flashcards for topic: ${topic}`);

    // Get all cards for topic and shuffle, take 10
    const pool = window.quizData.filter(q => q.topic === topic);

    if (pool.length === 0) {
        console.error(`No questions found for topic: ${topic}`);
        alert("No questions available for this topic.");
        return;
    }

    state.fcQuestions = shuffleArray([...pool]).slice(0, 10);
    state.fcIndex = 0;
    state.fcFlipped = false;

    updateFlashcardUI();
    showScreen('flashcard');
}

function updateFlashcardUI() {
    const q = state.fcQuestions[state.fcIndex];
    if (!q) return;

    document.getElementById('flashcard-topic-title').textContent = state.fcTopic;
    document.getElementById('flashcard-counter').textContent = `${state.fcIndex + 1} / ${state.fcQuestions.length}`;

    const card = document.querySelector('.flashcard');
    card.classList.remove('flipped');
    state.fcFlipped = false;

    // Reset content with small delay for animation if needed, but immediate is fine
    setTimeout(() => {
        document.getElementById('fc-question').textContent = q.question;
        document.getElementById('fc-answer').textContent = q.correctAnswer;
        document.getElementById('fc-explanation').textContent = q.explanation || "";
    }, 200);
}

function flipCard() {
    const card = document.querySelector('.flashcard');
    card.classList.toggle('flipped');
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

function startTest() {
    state.mode = 'test';
    // Select 24 random questions from the ENTIRE pool
    // Ensure we have enough questions
    if (!window.quizData || window.quizData.length === 0) {
        alert("No questions loaded!");
        return;
    }

    state.testQuestions = shuffleArray([...window.quizData]).slice(0, 24);
    state.testAnswers = {};
    state.testIndex = 0;
    state.timeRemaining = 45 * 60;

    startTimer();
    updateTestUI();
    showScreen('test');
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
