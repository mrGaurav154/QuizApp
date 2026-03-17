const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Category = require('../models/Category');

/**
 * Quiz Controller
 * Handles quiz CRUD operations
 */

// =============================================================================
// CREATE QUIZ
// =============================================================================

/**
 * Create a new quiz with questions
 * POST /api/quizzes
 */
const createQuiz = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            difficulty,
            timeLimit,
            passPercentage,
            questions,
            isPublished
        } = req.body;

        console.log('📝 Creating quiz:', { title, category, questionCount: questions?.length || 0 });

        // Validate required fields
        if (!title || !category || !difficulty || !timeLimit || !passPercentage) {
            return res.status(400).json({
                error: 'Missing required fields: title, category, difficulty, timeLimit, passPercentage'
            });
        }

        // Validate category exists
        if (!category || category.trim() === '') {
            return res.status(400).json({
                error: 'Category is required'
            });
        }

        // 1. Validate Category - find by name or ID
        let categoryId = null;
        let foundCategory = null;

        console.log('🔍 Looking for category:', category);

        try {
            // First try to find by ObjectId if it looks like one
            if (category.match(/^[0-9a-fA-F]{24}$/)) {
                foundCategory = await Category.findById(category);
                console.log('Found category by ID:', foundCategory ? foundCategory.name : 'not found');
            }

            // If not found, try by name (case-insensitive)
            if (!foundCategory) {
                foundCategory = await Category.findOne({
                    name: { $regex: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                });
                console.log('Found category by name:', foundCategory ? foundCategory.name : 'not found');
            }
        } catch (catError) {
            console.error('Error finding category:', catError.message);
            return res.status(400).json({
                error: 'Error validating category. Please try again.'
            });
        }

        if (!foundCategory) {
            console.warn('⚠️  Category not found:', category);
            // Fetch all categories for debugging
            const allCategories = await Category.find().select('name');
            console.log('Available categories:', allCategories.map(c => c.name));
            return res.status(400).json({
                error: 'Invalid category. Please select a valid category.',
                availableCategories: allCategories.map(c => c.name)
            });
        }

        categoryId = foundCategory._id;
        console.log('✅ Using category ID:', categoryId);

        // 2. Create Quiz
        const quiz = new Quiz({
            title: title.trim(),
            description: description?.trim() || '',
            category: categoryId,
            difficulty,
            timeLimit: parseInt(timeLimit),
            passPercentage: parseInt(passPercentage),
            isPublished: isPublished || false,
            createdBy: req.userId
        });

        // Generate access code if quiz is published
        if (isPublished) {
            const code = quiz.generateAccessCode();
            const baseUrl = process.env.BASE_URL || 'https://quizcraft-0q8m.onrender.com';
            quiz.joinLink = `${baseUrl}/join-quiz.html?code=${code}`;
            console.log('Generated access code:', code);
        }

        console.log('💾 Saving quiz to database...');
        await quiz.save();
        console.log('✅ Quiz saved with ID:', quiz._id);

        // 3. Create Questions
        if (questions && Array.isArray(questions) && questions.length > 0) {
            console.log('📝 Creating', questions.length, 'questions...');

            const questionData = questions.map((q, index) => {
                // Validate question data
                if (!q.questionText || !q.options || q.options.length === 0) {
                    throw new Error(`Question ${index + 1}: Missing question text or options`);
                }

                return {
                    quiz: quiz._id,
                    questionText: q.questionText.trim(),
                    options: q.options.map(opt => ({
                        text: typeof opt === 'string' ? opt : (opt.text || ''),
                        isCorrect: opt.isCorrect || false
                    })),
                    points: q.points || 1,
                    order: index,
                    explanation: q.explanation?.trim() || ''
                };
            });

            try {
                await Question.insertMany(questionData);
                console.log('✅ Questions created successfully');

                // Update quiz stats (totalPoints and questionCount)
                await quiz.updateStats();
                console.log('✅ Quiz stats updated');
            } catch (qError) {
                console.error('❌ Error creating questions:', qError.message);
                // Delete the quiz if questions fail
                await Quiz.findByIdAndDelete(quiz._id);
                throw new Error('Failed to create questions: ' + qError.message);
            }
        } else {
            console.warn('⚠️  No questions provided for quiz');
        }

        // Fetch the created quiz with populated fields
        const createdQuiz = await Quiz.findById(quiz._id)
            .populate('category', 'name')
            .populate('createdBy', 'name');

        console.log('✅ Quiz created and published successfully');

        res.status(201).json({
            message: 'Quiz created successfully',
            quiz: createdQuiz
        });

    } catch (error) {
        console.error('❌ Create quiz error:', error.message);
        console.error('Stack:', error.stack);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            console.error('Validation errors:', messages);
            return res.status(400).json({
                error: 'Validation failed',
                details: messages
            });
        }

        // Handle MongoDB errors
        if (error.name === 'MongooseError' || error.message?.includes('MongoDB')) {
            return res.status(503).json({
                error: 'Database error. Please try again in a moment.'
            });
        }

        res.status(500).json({
            error: error.message || 'Failed to create quiz',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// =============================================================================
// GET ALL QUIZZES
// =============================================================================

/**
 * Get all quizzes
 * GET /api/quizzes
 */
const getQuizzes = async (req, res) => {
    try {
        const { category, difficulty, teacher } = req.query;

        let query = {};

        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (teacher) query.createdBy = teacher;

        // If teacher is requested, usually they want their own quizzes (including drafts)
        // Public users should only see published quizzes
        if (!teacher) {
            query.isPublished = true;
        }

        const quizzes = await Quiz.find(query)
            .populate('category', 'name icon color')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.json({ quizzes });

    } catch (error) {
        console.error('Get quizzes error:', error);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
};

// =============================================================================
// GET SINGLE QUIZ
// =============================================================================

/**
 * Get quiz by ID with questions
 * GET /api/quizzes/:id
 */
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('category', 'name icon color')
            .populate('createdBy', 'name')
            .populate('questions');

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json({ quiz });

    } catch (error) {
        console.error('Get quiz error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
};

// =============================================================================
// DELETE QUIZ
// =============================================================================

/**
 * Delete quiz
 * DELETE /api/quizzes/:id
 */
const deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Check ownership - convert both to strings for comparison
        const quizCreatorId = quiz.createdBy.toString();
        const userId = req.userId.toString();

        if (quizCreatorId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to delete this quiz' });
        }

        // Questions are deleted via pre-remove hook in Quiz model (if implemented)
        // Our Quiz model uses post('remove') but Mongoose 5+ prefers middleware on deleteOne/findByIdAndDelete
        // Let's manually delete questions to be sure
        await Question.deleteMany({ quiz: quiz._id });
        await Quiz.findByIdAndDelete(req.params.id);

        res.json({ message: 'Quiz and associated questions deleted successfully' });

    } catch (error) {
        console.error('Delete quiz error:', error);
        res.status(500).json({ error: 'Failed to delete quiz' });
    }
};

/**
 * Generate or regenerate access code for a quiz
 * POST /api/quizzes/:id/generate-code
 */
const generateCode = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Check ownership - convert both to strings for comparison
        const quizCreatorId = quiz.createdBy.toString();
        const userId = req.userId.toString();

        if (quizCreatorId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Generate new code
        const code = quiz.generateAccessCode();
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        quiz.joinLink = `${baseUrl}/join-quiz.html?code=${code}`;

        await quiz.save();

        res.json({
            message: 'Access code generated successfully',
            accessCode: quiz.accessCode,
            joinLink: quiz.joinLink
        });

    } catch (error) {
        console.error('Generate code error:', error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
};

/**
 * Get quiz by access code (public endpoint)
 * GET /api/quizzes/join/:code
 */
const getQuizByCode = async (req, res) => {
    try {
        const { code } = req.params;

        const quiz = await Quiz.findOne({
            accessCode: code.toUpperCase(),
            isPublished: true
        })
            .populate('category', 'name icon color')
            .populate('createdBy', 'name');

        if (!quiz) {
            return res.status(404).json({ error: 'Invalid code or quiz not found' });
        }

        res.json({
            quiz: {
                id: quiz._id,
                title: quiz.title,
                description: quiz.description,
                category: quiz.category,
                difficulty: quiz.difficulty,
                timeLimit: quiz.timeLimit,
                questionCount: quiz.questionCount,
                createdBy: quiz.createdBy
            }
        });

    } catch (error) {
        console.error('Get quiz by code error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
};

module.exports = {
    createQuiz,
    getQuizzes,
    getQuizById,
    deleteQuiz,
    generateCode,
    getQuizByCode
};
