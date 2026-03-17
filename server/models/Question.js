const mongoose = require('mongoose');

/**
 * Question Schema
 * MCQ questions belonging to a quiz
 */
const questionSchema = new mongoose.Schema({
    // Parent quiz reference
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: [true, 'Quiz reference is required']
    },
    
    // Question text
    questionText: {
        type: String,
        required: [true, 'Question text is required'],
        trim: true,
        minlength: [5, 'Question must be at least 5 characters'],
        maxlength: [1000, 'Question cannot exceed 1000 characters']
    },
    
    // Four options (MCQ)
    options: [{
        text: {
            type: String,
            required: [true, 'Option text is required'],
            trim: true,
            maxlength: [500, 'Option text cannot exceed 500 characters']
        },
        isCorrect: {
            type: Boolean,
            default: false
        }
    }],
    
    // Points for this question
    points: {
        type: Number,
        min: [1, 'Points must be at least 1'],
        max: [100, 'Points cannot exceed 100'],
        default: 1
    },
    
    // Order in the quiz (for sorting)
    order: {
        type: Number,
        default: 0
    },
    
    // Optional image URL for the question
    imageUrl: {
        type: String,
        default: ''
    },
    
    // Explanation shown after answering
    explanation: {
        type: String,
        trim: true,
        maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
        default: ''
    },
    
    // Time limit override (seconds, null = use quiz default)
    timeLimitOverride: {
        type: Number,
        min: [5, 'Time limit must be at least 5 seconds'],
        max: [300, 'Time limit cannot exceed 300 seconds'],
        default: null
    }
    
}, {
    timestamps: true
});

// =============================================================================
// INDEXES
// =============================================================================

questionSchema.index({ quiz: 1, order: 1 });

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that exactly 4 options exist and exactly 1 is correct
 */
questionSchema.pre('validate', function(next) {
    if (this.options) {
        // Check for exactly 4 options
        if (this.options.length !== 4) {
            this.invalidate('options', 'Exactly 4 options are required');
            return next();
        }
        
        // Check for exactly 1 correct answer
        const correctCount = this.options.filter(opt => opt.isCorrect).length;
        if (correctCount !== 1) {
            this.invalidate('options', 'Exactly one option must be marked as correct');
        }
    }
    next();
});

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Get the correct answer index (0-3)
 */
questionSchema.methods.getCorrectIndex = function() {
    return this.options.findIndex(opt => opt.isCorrect);
};

/**
 * Check if an answer is correct
 * @param {number} answerIndex - The index of the selected answer (0-3)
 */
questionSchema.methods.isAnswerCorrect = function(answerIndex) {
    if (answerIndex < 0 || answerIndex >= this.options.length) {
        return false;
    }
    return this.options[answerIndex].isCorrect;
};

/**
 * Shuffle options (for randomizing order during quiz)
 */
questionSchema.methods.getShuffledOptions = function() {
    const shuffled = [...this.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Get questions for a quiz in order
 */
questionSchema.statics.getByQuiz = function(quizId) {
    return this.find({ quiz: quizId }).sort({ order: 1 });
};

/**
 * Reorder questions in a quiz
 * @param {ObjectId} quizId - Quiz ID
 * @param {Array} questionIds - Array of question IDs in new order
 */
questionSchema.statics.reorder = async function(quizId, questionIds) {
    const updates = questionIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id, quiz: quizId },
            update: { order: index }
        }
    }));
    
    return this.bulkWrite(updates);
};

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Update quiz stats when question is saved
 */
questionSchema.post('save', async function() {
    const Quiz = mongoose.model('Quiz');
    const quiz = await Quiz.findById(this.quiz);
    if (quiz) {
        await quiz.updateStats();
    }
});

/**
 * Update quiz stats when question is removed
 */
questionSchema.post('remove', async function() {
    const Quiz = mongoose.model('Quiz');
    const quiz = await Quiz.findById(this.quiz);
    if (quiz) {
        await quiz.updateStats();
    }
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
