const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validateInput');

/**
 * Auth Routes
 * Session-Based Authentication
 */

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Teacher or Admin)
 * @access  Public
 * @body    { name, email, password, role, institution?, organization? }
 */
router.post('/register', registerValidation, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and create session
 * @access  Public
 * @body    { email, password, role? }
 */
router.post('/login', loginValidation, authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and destroy session
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @route   GET /api/auth/check
 * @desc    Check if user is authenticated
 * @access  Public
 */
router.get('/check', authController.checkAuth);

// =============================================================================
// PROTECTED ROUTES
// =============================================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', auth, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.put('/password', auth, authController.changePassword);

module.exports = router;
