const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { auth } = require('../middleware/auth');

/**
 * Public routes (no authentication required)
 */

// Create or update student profile
router.post('/create', studentController.createStudent);

// Verify quiz code
router.post('/verify-code', studentController.verifyQuizCode);

// Join quiz
router.post('/join-quiz', studentController.joinQuiz);

// Get student by email
router.get('/email/:email', studentController.getStudentByEmail);

/**
 * Protected routes (require authentication - teacher only)
 */

// Get all students for a specific quiz
router.get('/quiz/:quizId', auth, studentController.getStudentsByQuiz);

// Get all students for logged-in teacher
router.get('/teacher', auth, studentController.getStudentsByTeacher);

module.exports = router;
