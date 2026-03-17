const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 * Returns 400 with error details if validation fails
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    
    next();
};

// =============================================================================
// AUTH VALIDATION RULES
// =============================================================================

const registerValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number'),
    
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['admin', 'teacher', 'student']).withMessage('Invalid role'),
    
    body('institution')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Institution name too long'),
    
    body('organization')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Organization name too long'),
    
    handleValidationErrors
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
    
    handleValidationErrors
];

// =============================================================================
// QUIZ VALIDATION RULES
// =============================================================================

const quizValidation = [
    body('title')
        .trim()
        .notEmpty().withMessage('Quiz title is required')
        .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Description too long'),
    
    body('category')
        .notEmpty().withMessage('Category is required')
        .trim(),
        // Accept both ObjectId and category name - backend will handle lookup
    
    body('timeLimit')
        .optional()
        .isInt({ min: 1, max: 180 }).withMessage('Time limit must be 1-180 minutes'),
    
    body('difficulty')
        .optional()
        .isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
    
    body('passPercentage')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Pass percentage must be 0-100'),
    
    body('questions')
        .optional()
        .isArray().withMessage('Questions must be an array'),
    
    body('isPublished')
        .optional()
        .isBoolean().withMessage('isPublished must be a boolean'),
    
    handleValidationErrors
];

// =============================================================================
// QUESTION VALIDATION RULES
// =============================================================================

const questionValidation = [
    body('questionText')
        .trim()
        .notEmpty().withMessage('Question text is required')
        .isLength({ min: 5, max: 1000 }).withMessage('Question must be 5-1000 characters'),
    
    body('options')
        .isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options are required'),
    
    body('options.*.text')
        .trim()
        .notEmpty().withMessage('Option text is required')
        .isLength({ max: 500 }).withMessage('Option text too long'),
    
    body('options.*.isCorrect')
        .isBoolean().withMessage('isCorrect must be a boolean'),
    
    handleValidationErrors
];

// =============================================================================
// CATEGORY VALIDATION RULES
// =============================================================================

const categoryValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description too long'),
    
    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Icon identifier too long'),
    
    handleValidationErrors
];

// =============================================================================
// COMMON VALIDATION RULES
// =============================================================================

const mongoIdParam = [
    param('id')
        .isMongoId().withMessage('Invalid ID format'),
    
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    registerValidation,
    loginValidation,
    quizValidation,
    questionValidation,
    categoryValidation,
    mongoIdParam
};
