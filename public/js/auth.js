/**
 * Shared Authentication Utilities
 * Session-based authentication helper for all protected pages
 */

// ============================================================================
// API CONFIGURATION
// ============================================================================

/**
 * Get the API base URL
 * In production: Use environment-specific API URL
 * In development: Use localhost
 */
const getApiUrl = () => {
    // Check if API_URL is defined globally
    if (window.API_URL) {
        return window.API_URL;
    }

    // Auto-detect based on current location
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Local development - SAME ORIGIN (running via node server)
    // If we are on port 3000 or 3001, use relative paths
    if (port === '3000' || port === '3001') {
        return '';
    }

    // Local development - DIFFERENT ORIGIN (e.g., Live Server on 5500)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
    }

    // Production detection (Render or others)
    // If we are on a custom domain or Render URL, and it's not localhost
    // We assume the API is served from the same origin (relative path)
    // unless explicitly configured otherwise.
    return '';
};

const API_URL = getApiUrl();

console.log('🌐 API URL:', API_URL);

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Check if user is authenticated via session
 */
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            credentials: "include", // Important: Include cookies
        });

        if (!response.ok) {
            // Not authenticated - redirect to login
            localStorage.removeItem("user");
            window.location.href = "/login.html";
            return null;
        }

        const data = await response.json();
        // Update localStorage with fresh user data
        localStorage.setItem("user", JSON.stringify(data.user));
        return data.user;
    } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("user");
        window.location.href = "/login.html";
        return null;
    }
}

/**
 * Update user UI elements (sidebar, headers, etc.)
 */
function updateUserUI(user) {
    // Update user name
    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
        userNameEl.textContent = user.name || "User";
    }

    // Update user initial
    const userInitialEl = document.getElementById("userInitial");
    if (userInitialEl) {
        userInitialEl.textContent = (user.name?.[0] || "U").toUpperCase();
    }

    // Update welcome name (if exists)
    const welcomeNameEl = document.getElementById("welcomeName");
    if (welcomeNameEl) {
        welcomeNameEl.textContent = user.name?.split(" ")[0] || "User";
    }
}

/**
 * Setup logout button
 */
function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: "POST",
                    credentials: "include",
                });
            } catch (e) {
                console.error("Logout error:", e);
            }
            localStorage.removeItem("user");
            window.location.href = "/login.html";
        });
    }
}

/**
 * Initialize authentication for a protected page
 */
async function initAuth() {
    const user = await checkAuth();
    if (user) {
        updateUserUI(user);
        setupLogout();
    }
    return user;
}

/**
 * Make authenticated fetch request (includes credentials)
 * This function automatically prepends API_URL to relative paths
 */
async function authFetch(url, options = {}) {
    // Prepend API_URL if url doesn't start with http
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

    return fetch(fullUrl, {
        ...options,
        credentials: "include",
    });
}

/**
 * API helper object with common HTTP methods
 */
const api = {
    /**
     * GET request
     */
    async get(endpoint) {
        const response = await authFetch(endpoint);
        return await response.json();
    },

    /**
     * POST request
     */
    async post(endpoint, data) {
        const response = await authFetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    /**
     * PUT request
     */
    async put(endpoint, data) {
        const response = await authFetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    /**
     * DELETE request
     */
    async delete(endpoint) {
        const response = await authFetch(endpoint, {
            method: 'DELETE'
        });
        return await response.json();
    }
};

// ============================================================================
// EXPORTS (if using modules) or expose globally
// ============================================================================

// If you're using this file as a script tag, these are already global
// If using modules, export them:
// export { API_URL, checkAuth, updateUserUI, setupLogout, initAuth, authFetch, api };
