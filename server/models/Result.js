const mongoose = require('mongoose');

/**
 * Result Schema
 * Stores quiz attempt results and answers
 */
const resultSchema = new mongoose.Schema({
    // User who took the quiz (for authenticated users)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    
    // Student who took the quiz (for guest students)
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: false
    },
    
    // Participant type
    participantType: {
        type: String,
        enum: ['user', 'student'],
        required: true
    },
    
    // Quiz that was taken
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: [true, 'Quiz reference is required']
    },
    
    // Score achieved
    score: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Total questions in the quiz
    totalQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Number of correct answers
    correctAnswers: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Number of incorrect answers
    incorrectAnswers: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Number of unanswered questions
    unanswered: {
        type: Number,
        default: 0
    },
    
    // Total points possible
    totalPoints: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Time taken in seconds
    timeTaken: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Time limit in seconds (from quiz)
    timeLimit: {
        type: Number
    },
    
    // Whether the quiz was auto-submitted due to timeout
    wasTimeout: {
        type: Boolean,
        default: false
    },
    
    // Percentage score
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },
    
    // Individual question answers
    answers: [{
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        selectedOption: {
            type: Number, // Index of selected option (0-3), -1 if unanswered
            min: -1,
            max: 3,
            default: -1
        },
        isCorrect: {
            type: Boolean,
            default: false
        },
        pointsEarned: {
            type: Number,
            default: 0
        },
        timeSpent: {
            type: Number, // Time spent on this question in seconds
            default: 0
        }
    }],
    
    // When the quiz was started
    startedAt: {
        type: Date,
        required: true
    },
    
    // When the quiz was completed
    completedAt: {
        type: Date,
        default: Date.now
    },
    
    // IP address (for analytics)
    ipAddress: {
        type: String
    },
    
    // User agent (for analytics)
    userAgent: {
        type: String
    }
    
}, {
    timestamps: true
});

// =============================================================================
// INDEXES
// =============================================================================

resultSchema.index({ user: 1, quiz: 1 });
resultSchema.index({ quiz: 1 });
resultSchema.index({ user: 1 });
resultSchema.index({ completedAt: -1 });
resultSchema.index({ percentage: -1 });

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

/**
 * Calculate derived fields before saving
 */
resultSchema.pre('save', function(next) {
    // Calculate percentage if not set
    if (this.totalPoints > 0 && this.percentage === undefined) {
        this.percentage = Math.round((this.score / this.totalPoints) * 100);
    }
    
    // Calculate incorrect answers if not set
    if (this.incorrectAnswers === undefined) {
        this.incorrectAnswers = this.totalQuestions - this.correctAnswers - (this.unanswered || 0);
    }
    
    next();
});

// =============================================================================
// POST-SAVE MIDDLEWARE
// =============================================================================

/**
 * Update quiz statistics after result is saved
 */
resultSchema.post('save', async function() {
    const Quiz = mongoose.model('Quiz');
    const Result = mongoose.model('Result');
    
    // Get all results for this quiz
    const results = await Result.find({ quiz: this.quiz });
    
    // Calculate average score
    const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0);
    const averageScore = results.length > 0 ? Math.round(totalPercentage / results.length) : 0;
    
    // Update quiz
    await Quiz.findByIdAndUpdate(this.quiz, {
        attemptCount: results.length,
        averageScore: averageScore
    });
});

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Get a formatted summary of the result
 */
resultSchema.methods.getSummary = function() {
    const minutes = Math.floor(this.timeTaken / 60);
    const seconds = this.timeTaken % 60;
    
    return {
        score: this.score,
        totalPoints: this.totalPoints,
        percentage: this.percentage,
        correctAnswers: this.correctAnswers,
        incorrectAnswers: this.incorrectAnswers,
        unanswered: this.unanswered,
        totalQuestions: this.totalQuestions,
        timeTaken: `${minutes}m ${seconds}s`,
        wasTimeout: this.wasTimeout,
        grade: this.getGrade()
    };
};

/**
 * Get letter grade based on percentage
 */
resultSchema.methods.getGrade = function() {
    if (this.percentage >= 90) return 'A+';
    if (this.percentage >= 80) return 'A';
    if (this.percentage >= 70) return 'B';
    if (this.percentage >= 60) return 'C';
    if (this.percentage >= 50) return 'D';
    return 'F';
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Get results for a user
 */
resultSchema.statics.getByUser = function(userId, limit = 10) {
    return this.find({ user: userId })
        .populate('quiz', 'title category difficulty')
        .sort({ completedAt: -1 })
        .limit(limit);
};

/**
 * Get results for a quiz
 */
resultSchema.statics.getByQuiz = function(quizId) {
    return this.find({ quiz: quizId })
        .populate('user', 'name email')
        .sort({ percentage: -1, timeTaken: 1 });
};

/**
 * Get leaderboard for a quiz
 */
resultSchema.statics.getLeaderboard = function(quizId, limit = 10) {
    return this.find({ quiz: quizId })
        .populate('user', 'name avatar')
        .sort({ percentage: -1, timeTaken: 1 })
        .limit(limit)
        .select('user percentage score timeTaken completedAt');
};

/**
 * Get user's best result for a quiz
 */
resultSchema.statics.getBestResult = function(userId, quizId) {
    return this.findOne({ user: userId, quiz: quizId })
        .sort({ percentage: -1 });
};

/**
 * Get statistics for a quiz
 */
resultSchema.statics.getQuizStats = async function(quizId) {
    const results = await this.find({ quiz: quizId });
    
    if (results.length === 0) {
        return {
            attemptCount: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            averageTime: 0,
            passRate: 0
        };
    }
    
    const percentages = results.map(r => r.percentage);
    const times = results.map(r => r.timeTaken);
    const passed = results.filter(r => r.percentage >= 60).length;
    
    return {
        attemptCount: results.length,
        averageScore: Math.round(percentages.reduce((a, b) => a + b, 0) / results.length),
        highestScore: Math.max(...percentages),
        lowestScore: Math.min(...percentages),
        averageTime: Math.round(times.reduce((a, b) => a + b, 0) / results.length),
        passRate: Math.round((passed / results.length) * 100)
    };
};

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;
