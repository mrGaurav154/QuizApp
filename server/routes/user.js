const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../middleware/validateInput');

/**
 * User Routes
 * Handles user profile and admin management endpoints
 */

// =============================================================================
// PROFILE ROUTES (Authenticated users)
// =============================================================================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', auth, userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 * @body    { name?, institution?, organization?, avatar? }
 */
router.put('/profile', auth, userController.updateProfile);

/**
 * @route   PUT /api/users/onboarding
 * @desc    Complete user onboarding
 * @access  Private
 * @body    { categories? }
 */
router.put('/onboarding', auth, userController.completeOnboarding);

/**
 * @route   GET /api/users/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats', auth, userController.getDashboardStats);

// =============================================================================
// ADMIN ROUTES (Admin only)
// =============================================================================

/**
 * @route   GET /api/users/teachers
 * @desc    Get all teachers
 * @access  Admin only
 * @query   { page?, limit?, search?, status? }
 */
router.get('/teachers', auth, adminOnly, userController.getAllTeachers);

/**
 * @route   GET /api/users/teachers/:id
 * @desc    Get teacher by ID
 * @access  Admin only
 */
router.get('/teachers/:id', auth, adminOnly, mongoIdParam, userController.getTeacherById);

/**
 * @route   PUT /api/users/teachers/:id
 * @desc    Update teacher
 * @access  Admin only
 * @body    { name?, institution?, isActive? }
 */
router.put('/teachers/:id', auth, adminOnly, mongoIdParam, userController.updateTeacher);

/**
 * @route   DELETE /api/users/teachers/:id
 * @desc    Delete teacher
 * @access  Admin only
 */
router.delete('/teachers/:id', auth, adminOnly, mongoIdParam, userController.deleteTeacher);

module.exports = router;
