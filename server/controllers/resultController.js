const { Result, Quiz, Question, Student, User } = require('../models');

/**
 * Result Controller
 * Handles quiz submission, result calculation, and retrieval
 */

// =============================================================================
// SUBMIT QUIZ
// =============================================================================

/**
 * Submit quiz answers and calculate results
 * POST /api/results/submit
 */
const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers, timeTaken, studentId, participantType = 'student' } = req.body;

        console.log('📝 Submitting quiz:', {
            quizId,
            answerCount: answers?.length || 0,
            timeTaken,
            studentId,
            participantType
        });

        // Validate required fields
        if (!quizId) {
            return res.status(400).json({
                success: false,
                message: 'Quiz ID is required'
            });
        }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                message: 'Answers array is required'
            });
        }

        if (!['student', 'user'].includes(participantType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid participant type'
            });
        }

        // 1. Fetch quiz and questions
        const quiz = await Quiz.findById(quizId).populate('questions');

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        if (!quiz.questions || quiz.questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Quiz has no questions'
            });
        }

        console.log('✅ Quiz loaded, questions:', quiz.questions.length);

        // 2. Get participant (student or user)
        let participantRef = null;
        
        if (participantType === 'student') {
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required for student submissions. Please verify your profile was created correctly.',
                    debug: {
                        studentId: !!studentId,
                        participantType
                    }
                });
            }
            participantRef = await Student.findById(studentId);
            if (!participantRef) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found. Please try joining the quiz again.',
                    studentId: studentId
                });
            }
        } else {
            // For authenticated users
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            participantRef = await User.findById(req.userId);
            if (!participantRef) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        console.log('✅ Participant found:', participantRef.name || participantRef.email);

        // 3. Calculate scores
        let correctAnswers = 0;
        let totalPoints = 0;
        let scorePoints = 0;
        const resultAnswers = [];

        const questionMap = new Map();
        quiz.questions.forEach(q => {
            questionMap.set(q._id.toString(), q);
            totalPoints += q.points || 1;
        });

        console.log('📊 Total possible points:', totalPoints);

        // Process each answer
        answers.forEach((answer) => {
            const questionId = answer.questionId;
            const selectedOption = answer.selectedOption;
            
            const question = questionMap.get(questionId);

            if (!question) {
                console.warn('⚠️  Question not found:', questionId);
                return; // Skip if question not found
            }

            let isCorrect = false;
            let pointsEarned = 0;

            // Check if answer is correct
            if (selectedOption >= 0 && selectedOption < question.options.length) {
                if (question.options[selectedOption].isCorrect) {
                    isCorrect = true;
                    pointsEarned = question.points || 1;
                    correctAnswers++;
                    scorePoints += pointsEarned;
                }
            }

            resultAnswers.push({
                question: question._id,
                selectedOption: selectedOption,
                isCorrect: isCorrect,
                pointsEarned: pointsEarned
            });
        });

        const incorrectAnswers = answers.length - correctAnswers;
        const unanswered = quiz.questions.length - answers.length;
        const percentage = totalPoints > 0 ? Math.round((scorePoints / totalPoints) * 100) : 0;

        console.log('✅ Results calculated:', {
            correctAnswers,
            incorrectAnswers,
            unanswered,
            scorePoints,
            percentage
        });

        // 4. Create result record
        const result = new Result({
            quiz: quizId,
            [participantType]: participantRef._id,
            participantType,
            score: scorePoints,
            totalQuestions: quiz.questions.length,
            correctAnswers,
            incorrectAnswers,
            unanswered,
            totalPoints,
            timeTaken: timeTaken || 0,
            timeLimit: quiz.timeLimit * 60, // Convert to seconds
            percentage,
            answers: resultAnswers,
            startedAt: new Date(Date.now() - (timeTaken || 0) * 1000),
            completedAt: new Date()
        });

        await result.save();
        console.log('✅ Result saved with ID:', result._id);

        // 5. Update student average score if applicable
        if (participantType === 'student') {
            await participantRef.updateAverageScore();
        }

        // 6. Update quiz statistics
        quiz.attemptCount = (quiz.attemptCount || 0) + 1;
        const existingAverageScore = quiz.averageScore || 0;
        quiz.averageScore = Math.round(
            ((existingAverageScore * (quiz.attemptCount - 1)) + percentage) / quiz.attemptCount
        );
        await quiz.save();

        console.log('✅ Quiz stats updated');

        // 7. Emit Live Leaderboard Event (Gamification)
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(quizId.toString()).emit('student_finished', {
                    resultId: result._id,
                    studentName: participantRef.name || participantRef.email,
                    score: result.score,
                    percentage: result.percentage,
                    timeTaken: result.timeTaken,
                    completedAt: result.completedAt
                });
                console.log(`📢 Emitted student_finished for ${participantRef.name} in room ${quizId}`);
            }
        } catch (socketErr) {
            console.error('Socket emit error:', socketErr);
        }

        res.status(201).json({
            success: true,
            message: 'Quiz submitted successfully',
            resultId: result._id,
            data: {
                id: result._id,
                score: result.score,
                percentage: result.percentage,
                correctAnswers: result.correctAnswers,
                totalQuestions: result.totalQuestions,
                timeTaken: result.timeTaken
            }
        });

    } catch (error) {
        console.error('❌ Submit quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit quiz',
            error: error.message
        });
    }
};

// =============================================================================
// GET RESULT
// =============================================================================

/**
 * Get a specific result by ID
 * GET /api/results/:id
 */
const getResult = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Result.findById(id)
            .populate('quiz', 'title description category difficulty passPercentage')
            .populate('student', 'name email avatar className')
            .populate('user', 'name email')
            .populate('answers.question', 'questionText options points');

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Result not found'
            });
        }

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch result',
            error: error.message
        });
    }
};

// =============================================================================
// GET RESULTS FOR QUIZ
// =============================================================================

/**
 * Get all results for a specific quiz (teacher only)
 * GET /api/results/quiz/:quizId
 */
const getResultsByQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;

        // Verify quiz exists and user is creator
        const quiz = await Quiz.findById(quizId);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check authorization (must be quiz creator) - convert both to strings for comparison
        const quizCreatorId = quiz.createdBy.toString();
        const userId = req.userId.toString();
        
        if (quizCreatorId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view results for this quiz'
            });
        }

        // Get all results
        const results = await Result.find({ quiz: quizId })
            .populate('student', 'name email avatar className')
            .populate('user', 'name email')
            .sort({ completedAt: -1 });

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results',
            error: error.message
        });
    }
};

// =============================================================================
// GET RESULTS FOR STUDENT
// =============================================================================

/**
 * Get all results for a specific student
 * GET /api/results/student/:studentId
 */
const getResultsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const results = await Result.find({ 
            student: studentId,
            participantType: 'student'
        })
            .populate('quiz', 'title description category difficulty')
            .sort({ completedAt: -1 });

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('Get student results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results',
            error: error.message
        });
    }
};

// =============================================================================
// GET RESULTS FOR USER
// =============================================================================

/**
 * Get all results for authenticated user
 * GET /api/results/user/me
 */
const getMyResults = async (req, res) => {
    try {
        const results = await Result.find({ 
            user: req.userId,
            participantType: 'user'
        })
            .populate('quiz', 'title description category difficulty')
            .sort({ completedAt: -1 });

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('Get my results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results',
            error: error.message
        });
    }
};

// =============================================================================
// GET RESULTS FOR TEACHER'S STUDENTS
// =============================================================================

/**
 * Get all results for all students of a teacher's quizzes
 * GET /api/results/teacher/stats
 */
const getTeacherStats = async (req, res) => {
    try {
        const teacherId = req.userId;

        // Get all quizzes created by this teacher
        const quizzes = await Quiz.find({ createdBy: teacherId }).select('_id');
        const quizIds = quizzes.map(q => q._id);

        if (quizIds.length === 0) {
            return res.json({
                success: true,
                stats: {
                    totalAttempts: 0,
                    averageScore: 0,
                    totalStudents: 0,
                    totalQuizzes: 0
                },
                data: []
            });
        }

        // Get all results for these quizzes
        const results = await Result.find({ quiz: { $in: quizIds } })
            .populate('student', 'name email')
            .populate('quiz', 'title');

        // Calculate statistics
        const stats = {
            totalAttempts: results.length,
            averageScore: results.length > 0 
                ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
                : 0,
            totalStudents: new Set(results.map(r => r.student?._id?.toString())).size,
            totalQuizzes: quizIds.length
        };

        res.json({
            success: true,
            stats,
            data: results
        });

    } catch (error) {
        console.error('Get teacher stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

module.exports = {
    submitQuiz,
    getResult,
    getResultsByQuiz,
    getResultsByStudent,
    getMyResults,
    getTeacherStats
};
