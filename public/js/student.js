/**
 * Student Join Quiz Flow
 * Handles code verification, profile creation, and quiz joining
 */

// Avatar options (using emoji/icons as placeholders)
const AVATARS = [
  { id: 'avatar-1', emoji: '👨‍🎓', color: 'bg-blue-500' },
  { id: 'avatar-2', emoji: '👩‍🎓', color: 'bg-pink-500' },
  { id: 'avatar-3', emoji: '🧑‍💻', color: 'bg-green-500' },
  { id: 'avatar-4', emoji: '👨‍🔬', color: 'bg-purple-500' },
  { id: 'avatar-5', emoji: '👩‍🏫', color: 'bg-amber-500' },
  { id: 'avatar-6', emoji: '🧑‍🎨', color: 'bg-red-500' },
  { id: 'avatar-7', emoji: '👨‍🚀', color: 'bg-cyan-500' },
  { id: 'avatar-8', emoji: '👩‍⚕️', color: 'bg-emerald-500' },
  { id: 'avatar-9', emoji: '🧑‍🍳', color: 'bg-orange-500' },
  { id: 'avatar-10', emoji: '👨‍🎤', color: 'bg-indigo-500' },
  { id: 'avatar-11', emoji: '👩‍✈️', color: 'bg-violet-500' },
  { id: 'avatar-12', emoji: '🧑‍🌾', color: 'bg-lime-500' }
];

let currentQuizData = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Check if code is in URL
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');
  
  if (codeFromUrl) {
    document.getElementById('quizCode').value = codeFromUrl.toUpperCase();
    verifyCode();
  }

  // Setup event listeners
  document.getElementById('verifyBtn').addEventListener('click', verifyCode);
  document.getElementById('quizCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyCode();
    }
  });
  
  document.getElementById('quizCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  document.getElementById('submitProfile').addEventListener('click', submitProfile);

  // Generate avatar grid
  generateAvatarGrid();
});

/**
 * Generate avatar selection grid
 */
function generateAvatarGrid() {
  const grid = document.getElementById('avatarGrid');
  
  AVATARS.forEach(avatar => {
    const div = document.createElement('div');
    div.className = `${avatar.color} rounded-xl p-4 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border-2 border-transparent avatar-option`;
    div.dataset.avatarId = avatar.id;
    div.innerHTML = `<span class="text-3xl">${avatar.emoji}</span>`;
    
    div.addEventListener('click', () => selectAvatar(avatar.id));
    grid.appendChild(div);
  });
}

/**
 * Select an avatar
 */
function selectAvatar(avatarId) {
  // Remove selection from all avatars
  document.querySelectorAll('.avatar-option').forEach(el => {
    el.classList.remove('border-white', 'scale-110');
    el.classList.add('border-transparent');
  });

  // Select clicked avatar
  const selected = document.querySelector(`[data-avatar-id="${avatarId}"]`);
  selected.classList.add('border-white', 'scale-110');
  selected.classList.remove('border-transparent');
  
  document.getElementById('selectedAvatar').value = avatarId;
}

/**
 * Verify quiz code
 */
async function verifyCode() {
  const code = document.getElementById('quizCode').value.trim();
  const errorDiv = document.getElementById('codeError');
  const verifyBtn = document.getElementById('verifyBtn');

  if (!code || code.length !== 6) {
    errorDiv.textContent = 'Please enter a 6-character code';
    errorDiv.classList.remove('hidden');
    return;
  }

  errorDiv.classList.add('hidden');
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Verifying...';
  lucide.createIcons();

  try {
    const response = await fetch('/api/students/verify-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Invalid code');
    }

    // Store quiz data
    currentQuizData = data.data;

    // Show quiz info
    displayQuizInfo(currentQuizData);

    // Show profile form
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('quizInfo').classList.remove('hidden');
    document.getElementById('step3').classList.remove('hidden');

  } catch (error) {
    console.error('Verify code error:', error);
    errorDiv.textContent = error.message || 'Invalid code. Please try again.';
    errorDiv.classList.remove('hidden');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> Verify Code';
    lucide.createIcons();
  }
}

/**
 * Display quiz information
 */
function displayQuizInfo(quiz) {
  document.getElementById('quizTitle').textContent = quiz.title;
  document.getElementById('quizDescription').textContent = quiz.description || 'No description';
  document.getElementById('quizCategory').textContent = quiz.category?.name || 'General';
  document.getElementById('quizDifficulty').textContent = quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1);
  document.getElementById('quizTime').textContent = `${quiz.timeLimit} min`;
  document.getElementById('quizQuestions').textContent = `${quiz.questionCount} questions`;
}

/**
 * Submit student profile and join quiz
 */
async function submitProfile() {
  const name = document.getElementById('studentName').value.trim();
  const email = document.getElementById('studentEmail').value.trim();
  const avatar = document.getElementById('selectedAvatar').value;
  const className = document.getElementById('className').value.trim();
  const errorDiv = document.getElementById('profileError');
  const submitBtn = document.getElementById('submitProfile');

  // Validation
  if (!name) {
    errorDiv.textContent = 'Please enter your name';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!email) {
    errorDiv.textContent = 'Please enter your email';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!avatar) {
    errorDiv.textContent = 'Please select an avatar';
    errorDiv.classList.remove('hidden');
    return;
  }

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Creating Profile...';
  lucide.createIcons();

  try {
    // Step 1: Create/Update student profile
    const profileResponse = await fetch('/api/students/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        avatar,
        className
      })
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      throw new Error(profileData.message || 'Failed to create profile');
    }

    // Step 2: Join the quiz
    const joinResponse = await fetch('/api/students/join-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quizId: currentQuizData.id,
        studentEmail: email
      })
    });

    const joinData = await joinResponse.json();

    if (!joinResponse.ok) {
      throw new Error(joinData.message || 'Failed to join quiz');
    }

    // Store student info in localStorage for the quiz session
    localStorage.setItem('studentProfile', JSON.stringify({
      ...profileData.data,
      quizId: currentQuizData.id
    }));

    // Redirect to quiz page
    // Note: You'll need to create a quiz-taking page that accepts student participants
    window.location.href = `/quiz.html?id=${currentQuizData.id}&student=true`;

  } catch (error) {
    console.error('Submit profile error:', error);
    errorDiv.textContent = error.message || 'Failed to join quiz. Please try again.';
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="arrow-right" class="w-5 h-5"></i> Start Quiz';
    lucide.createIcons();
  }
}

/**
 * Get avatar display info
 */
function getAvatarInfo(avatarId) {
  return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
}
