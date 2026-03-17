/**
 * Students Dashboard
 * Fetch and display students for teacher
 */

// Avatar data (same as student.js)
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

let allStudents = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadStudents();
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', filterStudents);
  }
}

/**
 * Load all students for the teacher
 */
async function loadStudents() {
  try {
    const response = await fetch('/api/students/teacher', {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      throw new Error('Failed to fetch students');
    }

    const data = await response.json();
    allStudents = data.data || [];
    displayStudents(allStudents);
    updateStats(allStudents);

  } catch (error) {
    console.error('Load students error:', error);
    showError('Failed to load students. Please try again.');
  }
}

/**
 * Display students in grid
 */
function displayStudents(students) {
  const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
  
  if (!grid) return;

  if (students.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i data-lucide="users" class="w-16 h-16 text-zinc-600 mx-auto mb-4"></i>
        <h3 class="text-xl font-semibold text-zinc-400 mb-2">No Students Yet</h3>
        <p class="text-zinc-500">Students who join your quizzes will appear here</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = students.map(student => createStudentCard(student)).join('');
  lucide.createIcons();
}

/**
 * Create student card HTML
 */
function createStudentCard(student) {
  const avatarInfo = getAvatarInfo(student.avatar);
  const scoreColor = getScoreColor(student.averageScore);
  const lastActive = formatDate(student.lastActive);

  return `
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 ${avatarInfo.color} rounded-full flex items-center justify-center">
            <span class="text-2xl">${avatarInfo.emoji}</span>
          </div>
          <div>
            <h3 class="font-semibold">${escapeHtml(student.name)}</h3>
            <p class="text-sm text-zinc-500">${escapeHtml(student.email)}</p>
            ${student.className ? `<p class="text-xs text-zinc-600 mt-1">${escapeHtml(student.className)}</p>` : ''}
          </div>
        </div>
        <button class="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <i data-lucide="more-vertical" class="w-4 h-4 text-zinc-400"></i>
        </button>
      </div>
      <div class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-zinc-500">Quizzes Taken</span>
          <span class="font-medium">${student.totalQuizzes || 0}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-zinc-500">Average Score</span>
          <span class="font-medium ${scoreColor}">${student.averageScore || 0}%</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-zinc-500">Last Active</span>
          <span class="font-medium">${lastActive}</span>
        </div>
      </div>
      <div class="mt-4 pt-4 border-t border-zinc-800">
        <div class="flex items-center gap-2">
          <div class="flex-1 bg-zinc-800 rounded-full h-2">
            <div class="${scoreColor.replace('text-', 'bg-')} h-2 rounded-full" style="width: ${student.averageScore || 0}%"></div>
          </div>
          <span class="text-xs text-zinc-500">${student.averageScore || 0}%</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update statistics
 */
function updateStats(students) {
  const totalStudents = students.length;
  const activeThisWeek = students.filter(s => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(s.lastActive) > weekAgo;
  }).length;

  const avgPerformance = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + (s.averageScore || 0), 0) / students.length)
    : 0;

  // Update stat cards
  const statCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3 .text-3xl');
  if (statCards.length >= 3) {
    statCards[0].textContent = totalStudents;
    statCards[1].textContent = activeThisWeek;
    statCards[2].textContent = `${avgPerformance}%`;
  }
}

/**
 * Filter students based on search
 */
function filterStudents(e) {
  const query = e.target.value.toLowerCase();
  
  const filtered = allStudents.filter(student => {
    return student.name.toLowerCase().includes(query) ||
           student.email.toLowerCase().includes(query) ||
           (student.className && student.className.toLowerCase().includes(query));
  });

  displayStudents(filtered);
}

/**
 * Get avatar info by ID
 */
function getAvatarInfo(avatarId) {
  return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
}

/**
 * Get score color based on percentage
 */
function getScoreColor(score) {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Format date to relative time
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message) {
  const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
  if (grid) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
        <h3 class="text-xl font-semibold text-red-400 mb-2">Error</h3>
        <p class="text-zinc-400">${escapeHtml(message)}</p>
      </div>
    `;
    lucide.createIcons();
  }
}
