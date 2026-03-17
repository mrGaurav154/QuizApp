const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { auth } = require('../middleware/auth');

/**
 * Quiz Routes
 */

// Public routes
router.get('/', quizController.getQuizzes);
router.get('/join/:code', quizController.getQuizByCode); // Get quiz by access code
router.get('/:id', quizController.getQuizById);

// Protected routes
router.post('/', auth, quizController.createQuiz);
router.post('/:id/generate-code', auth, quizController.generateCode); // Generate access code
router.delete('/:id', auth, quizController.deleteQuiz);

module.exports = router;
