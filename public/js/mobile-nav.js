/**
 * Mobile Navigation Logic
 * Handles sidebar toggling on mobile devices
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const mobileHeader = document.getElementById('mobile-header');

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-40 hidden transition-opacity opacity-0';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // Toggle function
    window.toggleSidebar = function () {
        const isHidden = sidebar.classList.contains('-translate-x-full');

        if (isHidden) {
            // Open sidebar
            sidebar.classList.remove('-translate-x-full');
            // Show overlay
            overlay.classList.remove('hidden');
            // Small delay to allow transition to work
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
            }, 10);
        } else {
            // Close sidebar
            sidebar.classList.add('-translate-x-full');
            // Hide overlay
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        }
    };

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', window.toggleSidebar);

    // Close sidebar when clicking a link (on mobile)
    const links = sidebar.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                window.toggleSidebar();
            }
        });
    });

    // Handle resize events
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            // Reset styles on desktop
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.add('hidden', 'opacity-0');
        } else {
            // Ensure sidebar is hidden on mobile init if not toggled
            if (!overlay.classList.contains('hidden')) {
                sidebar.classList.remove('-translate-x-full');
            } else {
                sidebar.classList.add('-translate-x-full');
            }
        }
    });

    // Initial check
    if (window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
    }
});
