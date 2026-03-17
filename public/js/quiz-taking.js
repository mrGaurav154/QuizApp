/**
 * Quiz Taking Logic
 * Handles quiz flow, timer, and submission
 */

let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = new Map(); // questionId -> selectedOptionIndex
let timerInterval = null;
let secondsRemaining = 0;
let isStudent = false;
let studentProfile = null;

// Anti-Cheat Variables
let warningCount = 0;
const MAX_WARNINGS = 3;
let isQuizActive = false;
let isSubmitting = false;

// Utility: Shuffle Array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    isStudent = urlParams.get('student') === 'true';

    if (!quizId) {
        alert('No quiz specified');
        window.location.href = '/';
        return;
    }

    if (isStudent) {
        // Load student profile from local storage
        try {
            const storedProfile = localStorage.getItem('studentProfile');
            if (!storedProfile) {
                // If no profile found, redirect to join page
                window.location.href = `/join-quiz.html?code=${urlParams.get('code') || ''}`;
                return;
            }
            studentProfile = JSON.parse(storedProfile);
            
            // verify this profile matches the quiz
            if (studentProfile.quizId !== quizId) {
                 // Profile is for a different quiz, maybe show a warning or clear it?
                 // For now, let's assume one session at a time
            }

            document.getElementById('navStudentName').textContent = studentProfile.name;

        } catch (e) {
            console.error('Error loading student profile', e);
            window.location.href = '/join-quiz.html';
            return;
        }
    } else {
        // TODO: Handle authenticated user check
        // For now, we'll assume logged in or rely on API 401s
    }

    await loadQuiz(quizId);
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => {
        // Start proctoring if available
        if (typeof loadModels === 'function') {
            loadModels();
        }
        // Start the actual quiz flow
        startQuiz();
    });
    document.getElementById('prevBtn').addEventListener('click', prevQuestion);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('submitBtn').addEventListener('click', () => submitQuiz());
}

/**
 * Load quiz data
 */
async function loadQuiz(quizId) {
    try {
        let url = `/api/quizzes/${quizId}`;
        
        // If student, we might need a different endpoint that doesn't require auth 
        // OR rely on the fact that some quiz info is public?
        // Actually, for taking the quiz, we need the questions.
        // Protected quizzes usually require auth.
        // We probably need a public "start quiz" endpoint for students that validates the student ID/Access Code
        
        // For now let's use the public `getQuizByCode` logic or similar if it returns questions?
        // Wait, `getQuizByCode` (implemented earlier) DOES NOT return questions to prevent cheating before start.
        
        // We need an endpoint to "start" the quiz which returns the questions.
        // Let's try the standard endpoint. If it fails (401), we need a specific student endpoint.
        // Since I haven't implemented a specific `GET /api/students/quiz/:id/start` yet, 
        // I might run into an issue here if the standard endpoint is protected.
        
        // Checking `server/routes/quiz.js`:
        // `router.get('/:id', quizController.getQuizById);` is PUBLIC! (Line 11 in original file)
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load quiz');
        }

        currentQuiz = data.quiz;
        currentQuestions = currentQuiz.questions;

        // Anti-Cheat: Randomize options for each question
        currentQuestions.forEach(q => {
            if (q.options && q.options.length > 0) {
                // We must map it so we keep track of the original index to send the correct 'selectedOption' back,
                // BUT the backend expects the exact index of the original array. Wait, if the backend 
                // expects the original index, shuffling display options requires mapping the displayed index to original.
                // For simplicity and to not break the existing backend evaluation, we'll map the option to its original index.
                q.displayOptions = q.options.map((opt, index) => ({ text: opt.text, originalIndex: index }));
                shuffleArray(q.displayOptions);
            }
        });
        renderStartScreen();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');

    } catch (error) {
        console.error('Load quiz error:', error);
        document.getElementById('loading').innerHTML = `
            <div class="text-red-400 mb-4"><i data-lucide="alert-circle" class="w-12 h-12 mx-auto"></i></div>
            <p class="text-red-400">${error.message}</p>
            <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-zinc-800 rounded-lg">Retry</button>
        `;
        lucide.createIcons();
    }
}

function renderStartScreen() {
    document.getElementById('navQuizTitle').textContent = currentQuiz.title;
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    document.getElementById('quizDescription').textContent = currentQuiz.description || 'No description provided';
    document.getElementById('questionCount').textContent = currentQuestions.length;
    document.getElementById('timeLimit').textContent = currentQuiz.timeLimit + 'm';
    document.getElementById('passPercentage').textContent = currentQuiz.passPercentage + '%';
    
    // Icon
    const iconName = currentQuiz.category?.icon || 'book-open';
    const iconContainer = document.querySelector('#quizIcon').parentElement;
    iconContainer.innerHTML = `<i data-lucide="${iconName}" class="w-10 h-10 text-brand-400"></i>`;
    lucide.createIcons();
}

function startQuiz() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('questionScreen').classList.remove('hidden');
    
    isQuizActive = true;
    window.isQuizActive = true; // Keep proctor.js in sync
    setupSecurityListeners();

    // Start background music
    if (typeof window.startMusic === 'function') window.startMusic();

    // Force Fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.log('Fullscreen request denied:', err));
    }

    // Start timer
    secondsRemaining = currentQuiz.timeLimit * 60;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (!isQuizActive) return; // Pause timer during warnings

        secondsRemaining--;
        updateTimerDisplay();
        
        if (secondsRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up! Submitting your answers.');
            submitQuiz();
        }
    }, 1000);

    renderQuestion();
}

function updateTimerDisplay() {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = display;
    
    // Visual warning + urgency music when under 60 seconds
    if (secondsRemaining < 60) {
        document.getElementById('timerContainer').classList.add('border-red-500', 'text-red-500');
        document.getElementById('timerContainer').classList.remove('border-zinc-800');
        if (typeof window.setUrgencyMode === 'function') window.setUrgencyMode(true);
    }
}

function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    
    // Update progress
    document.getElementById('currentQuestionNum').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestionsNum').textContent = currentQuestions.length;
    
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;

    // Render text
    document.getElementById('questionText').textContent = question.questionText;
    
    // Render options (using the shuffled mapped options)
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    // Fallback to original options if displayOptions somehow isn't set
    const optionsToRender = question.displayOptions || question.options.map((o, i) => ({ text: o.text, originalIndex: i }));

    optionsToRender.forEach((displayOpt, index) => {
        const originalIndex = displayOpt.originalIndex;
        const isSelected = userAnswers.get(question._id) === originalIndex;
        
        const btn = document.createElement('button');
        btn.className = `w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
            isSelected 
                ? 'border-brand-500 bg-brand-500/10' 
                : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800'
        }`;
        
        btn.innerHTML = `
            <span class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    isSelected ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
                }">${String.fromCharCode(65 + index)}</span>
                <span class="${isSelected ? 'text-white' : 'text-zinc-300'}">${displayOpt.text}</span>
            </span>
            ${isSelected ? '<i data-lucide="check-circle" class="w-5 h-5 text-brand-500"></i>' : ''}
        `;
        
        btn.onclick = () => selectOption(question._id, originalIndex);
        optionsContainer.appendChild(btn);
    });
    
    lucide.createIcons();

    // Update buttons
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    
    const isLast = currentQuestionIndex === currentQuestions.length - 1;
    if (isLast) {
        document.getElementById('nextBtn').classList.add('hidden');
        document.getElementById('submitBtn').classList.remove('hidden');
    } else {
        document.getElementById('nextBtn').classList.remove('hidden');
        document.getElementById('submitBtn').classList.add('hidden');
    }
}

function selectOption(questionId, optionIndex) {
    userAnswers.set(questionId, optionIndex);
    renderQuestion(); // Re-render to show selection
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

async function submitQuiz(autoSubmitted = false) {
    if (isSubmitting) return;
    isSubmitting = true;
    isQuizActive = false;
    window.isQuizActive = false; // Keep proctor.js in sync
    clearInterval(timerInterval);
    
    // Stop background music
    if (typeof window.stopMusic === 'function') window.stopMusic();
    
    // Remove listeners
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlurEvent);

    
    // Show loading
    document.getElementById('questionScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    
    // Prepare payload
    const answers = [];
    userAnswers.forEach((selectedOption, questionId) => {
        answers.push({
            questionId: questionId,
            selectedOption: selectedOption
        });
    });
    
    const payload = {
        quizId: currentQuiz._id,
        answers: answers,
        timeTaken: (currentQuiz.timeLimit * 60) - secondsRemaining
    };
    
    if (isStudent) {
        payload.studentId = studentProfile._id || studentProfile.id;
        payload.participantType = 'student';
    } else {
        payload.participantType = 'user';
    }

    console.log('🎯 Submitting with payload:', payload);
    console.log('Student profile:', studentProfile);
    
    try {
        const response = await fetch('/api/results/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Submission failed');
        }
        
        console.log('✅ Quiz submitted successfully:', data);
        
        // Redirect to results page
        const resultId = data.resultId || data.data?.id;
        setTimeout(() => {
             if (isStudent) {
                 window.location.href = `/student-result.html?id=${resultId}`;
             } else {
                 window.location.href = `/results.html?id=${resultId}`;
             }
        }, 1500);
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Failed to submit quiz: ' + error.message);
        isSubmitting = false;
        document.getElementById('resultScreen').classList.add('hidden');
        document.getElementById('questionScreen').classList.remove('hidden');
    }
}

// =============================================================================
// ANTI-CHEAT MONITORING SYSTEM
// =============================================================================

function setupSecurityListeners() {
    // 1. Monitor Tab Switching
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // 2. Monitor Window Blur (clicking outside)
    window.addEventListener("blur", handleBlurEvent);

    // 3. Monitor Fullscreen exit
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && isQuizActive) {
            triggerWarning("Fullscreen Exit Detected", "You have exited fullscreen mode.");
        }
    });

    // 4. Behavioral Restrictions (Copy, Paste, Right-Click)
    document.addEventListener("contextmenu", e => { if(isQuizActive) e.preventDefault(); });
    document.addEventListener("copy", e => { if(isQuizActive) e.preventDefault(); });
    document.addEventListener("cut", e => { if(isQuizActive) e.preventDefault(); });
    document.addEventListener("paste", e => { if(isQuizActive) e.preventDefault(); });
    
    // 5. Block Keyboard Shortcuts (Print, Save, Inspect)
    document.addEventListener("keydown", e => {
        if (!isQuizActive) return;
        if (
            (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'c' || e.key === 'v' || e.key === 'u')) || // Print, save, copy, paste, view source
            (e.key === 'F12') || // Dev tools
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
        ) {
            e.preventDefault();
            triggerWarning("Prohibited Action", "Keyboard shortcuts are disabled during the quiz.");
        }
    });
}

function handleVisibilityChange() {
    if (document.hidden && isQuizActive) {
        triggerWarning("Tab Switched", "You switched to another tab or application.");
    }
}

function handleBlurEvent() {
    if (isQuizActive) {
        triggerWarning("Window Focus Lost", "You clicked outside the quiz window.");
    }
}

function triggerWarning(title, message) {
    if (!isQuizActive) return;
    
    isQuizActive = false; // Pause timer and listeners temporarily
    window.isQuizActive = false; // Keep proctor.js in sync
    warningCount++;

    if (warningCount >= MAX_WARNINGS) {
        autoSubmitQuiz();
    } else {
        showWarningModal(title, message, warningCount);
    }
}

// Expose these to proctor.js
// NOTE: window.isQuizActive is kept in sync manually at each state change above
window.isQuizActive = false; // initial state
window.triggerWarning = triggerWarning;
window.startQuiz = startQuiz;

function showWarningModal(title, message, count) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 z-[100] flex items-center justify-center px-4 bg-red-950/90 backdrop-blur-sm";
    modal.id = "cheatWarningModal";
    
    modal.innerHTML = `
        <div class="bg-zinc-900 border-2 border-red-600 rounded-2xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(220,38,38,0.5)] transform scale-100">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500"></i>
                </div>
                <h2 class="text-2xl font-bold mb-2 text-red-500">WARNING ${count}/${MAX_WARNINGS}</h2>
                <h3 class="text-xl font-semibold mb-2">${title}</h3>
                <p class="text-zinc-300 text-lg">${message}</p>
                <div class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p class="text-sm text-red-400 font-medium">
                        If you receive ${MAX_WARNINGS} warnings, your quiz will be automatically submitted with your current answers.
                    </p>
                </div>
            </div>
            <button id="acknowledgeWarningBtn" class="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-colors ring-4 ring-red-600/30">
                I Understand - Return to Quiz
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    lucide.createIcons();

    document.getElementById('acknowledgeWarningBtn').addEventListener('click', () => {
        modal.remove();
        isQuizActive = true;
        window.isQuizActive = true; // Keep proctor.js in sync — quiz is resuming
        // Optionally try to re-enter fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(e => console.log('Fs error:', e));
        }
    });
}

function autoSubmitQuiz() {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 z-[100] flex items-center justify-center px-4 bg-red-950/90 backdrop-blur-sm";
    
    modal.innerHTML = `
        <div class="bg-zinc-900 border-2 border-red-600 rounded-2xl w-full max-w-md p-8 relative shadow-[0_0_50px_rgba(220,38,38,0.5)] text-center">
            <div class="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <i data-lucide="shield-alert" class="w-10 h-10 text-red-500"></i>
            </div>
            <h2 class="text-3xl font-bold mb-4 text-red-500">Quiz Terminated</h2>
            <p class="text-zinc-300 text-lg mb-6">
                You have reached the maximum number of warnings (${MAX_WARNINGS}). Your quiz is being automatically submitted.
            </p>
            <div class="flex items-center justify-center gap-3 text-red-400">
                <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
                <span class="font-medium text-lg">Submitting quiz...</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    lucide.createIcons();
    
    // Call existing submit logic with auto flag
    submitQuiz(true);
}
