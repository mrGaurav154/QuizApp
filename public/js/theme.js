/**
 * theme.js
 * Dark/Light mode sync with system preference and manual override.
 * This script is loaded early (in <head>) to avoid flash of unstyled content.
 */

(function() {
    // Read saved preference or fall back to system preference
    const savedTheme = localStorage.getItem('quizcraft-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const isDark = savedTheme ? savedTheme === 'dark' : systemDark;
    
    if (!isDark) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

/**
 * Toggle between dark and light mode.
 * Called by the sun/moon button on every page.
 */
window.toggleTheme = function() {
    const isCurrentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    if (isCurrentlyLight) {
        // Switch to dark
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('quizcraft-theme', 'dark');
    } else {
        // Switch to light
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('quizcraft-theme', 'light');
    }
    
    updateThemeIcon();
};

function updateThemeIcon() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    
    // Update the icon
    icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
    if (window.lucide) lucide.createIcons();
}

// On DOM ready, set the correct icon
document.addEventListener('DOMContentLoaded', updateThemeIcon);

// Watch for OS system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only react if user hasn't manually set a preference
    if (!localStorage.getItem('quizcraft-theme')) {
        if (!e.matches) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        updateThemeIcon();
    }
});
