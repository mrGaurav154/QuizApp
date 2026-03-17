const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { auth } = require('../middleware/auth');

/**
 * Result Routes
 */

// Public routes
router.post('/submit', resultController.submitQuiz); // Submit quiz (works for both students and users)

// Protected routes (require authentication)
router.get('/quiz/:quizId', auth, resultController.getResultsByQuiz); // Get results for a quiz
router.get('/teacher/stats', auth, resultController.getTeacherStats); // Get teacher's statistics
router.get('/user/me', auth, resultController.getMyResults); // Get user's own results

// Public routes (placed after specific routes to avoid conflicts)
router.get('/student/:studentId', resultController.getResultsByStudent); // Get results for a student (public)
router.get('/:id', resultController.getResult); // Get specific result

module.exports = router;
