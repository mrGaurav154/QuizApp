const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, optionalAuth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleCheck');
const { categoryValidation, mongoIdParam } = require('../middleware/validateInput');

/**
 * Category Routes
 * Handles category CRUD endpoints
 */

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Public
 * @query   { active? }
 */
router.get('/', categoryController.getCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Get single category
 * @access  Public
 */
router.get('/:id', mongoIdParam, categoryController.getCategoryById);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

/**
 * @route   POST /api/categories
 * @desc    Create new category
 * @access  Admin only
 * @body    { name, description?, icon?, color? }
 */
router.post('/', auth, adminOnly, categoryValidation, categoryController.createCategory);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Admin only
 * @body    { name?, description?, icon?, color?, isActive? }
 */
router.put('/:id', auth, adminOnly, mongoIdParam, categoryController.updateCategory);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Admin only
 */
router.delete('/:id', auth, adminOnly, mongoIdParam, categoryController.deleteCategory);

/**
 * @route   POST /api/categories/seed
 * @desc    Seed default categories
 * @access  Admin only
 */
router.post('/seed', auth, adminOnly, categoryController.seedCategories);

module.exports = router;
