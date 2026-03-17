const mongoose = require('mongoose');

/**
 * Quiz Schema
 * Main quiz container with metadata
 */
const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Quiz title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: ''
    },
    
    // Category reference
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required']
    },
    
    // Quiz creator
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Time limit in minutes (null = no limit)
    timeLimit: {
        type: Number,
        min: [1, 'Time limit must be at least 1 minute'],
        max: [180, 'Time limit cannot exceed 180 minutes'],
        default: 15
    },
    
    // Difficulty level
    difficulty: {
        type: String,
        enum: {
            values: ['easy', 'medium', 'hard'],
            message: '{VALUE} is not a valid difficulty level'
        },
        default: 'medium'
    },
    
    // Publication status
    isPublished: {
        type: Boolean,
        default: false
    },
    
    // Number of questions (updated when questions are added/removed)
    questionCount: {
        type: Number,
        default: 0
    },
    
    // Total points possible
    totalPoints: {
        type: Number,
        default: 0
    },
    
    // Number of attempts
    attemptCount: {
        type: Number,
        default: 0
    },
    
    // Average score percentage
    averageScore: {
        type: Number,
        default: 0
    },
    
    // Cover image URL (optional)
    coverImage: {
        type: String,
        default: ''
    },
    
    // Tags for searching
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    
    // Sharing settings
    isPublic: {
        type: Boolean,
        default: false
    },
    
    // Access code for private quizzes
    accessCode: {
        type: String,
        trim: true,
        default: null
    },
    
    // Students who have joined this quiz
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    
    // Shareable join link
    joinLink: {
        type: String,
        default: ''
    }
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// =============================================================================
// INDEXES
// =============================================================================

quizSchema.index({ title: 'text', description: 'text', tags: 'text' });
quizSchema.index({ category: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ isPublished: 1 });
quizSchema.index({ difficulty: 1 });
quizSchema.index({ createdAt: -1 });

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Get questions for this quiz
 */
quizSchema.virtual('questions', {
    ref: 'Question',
    localField: '_id',
    foreignField: 'quiz'
});

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Update question count and total points
 */
quizSchema.methods.updateStats = async function() {
    const Question = mongoose.model('Question');
    const questions = await Question.find({ quiz: this._id });
    
    this.questionCount = questions.length;
    this.totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    
    return this.save();
};

/**
 * Generate a random access code
 */
quizSchema.methods.generateAccessCode = function() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    this.accessCode = code;
    return code;
};

/**
 * Check if user can access this quiz
 */
quizSchema.methods.canAccess = function(userId, providedCode = null) {
    // Creator can always access
    if (this.createdBy.toString() === userId.toString()) {
        return true;
    }
    
    // Public quizzes are accessible to all
    if (this.isPublic && this.isPublished) {
        return true;
    }
    
    // Check access code for private quizzes
    if (this.accessCode && providedCode === this.accessCode) {
        return true;
    }
    
    return false;
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Search quizzes by text
 */
quizSchema.statics.search = function(query, filters = {}) {
    const searchQuery = {
        isPublished: true,
        ...filters
    };
    
    if (query) {
        searchQuery.$text = { $search: query };
    }
    
    return this.find(searchQuery)
        .populate('category', 'name icon color')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
};

/**
 * Get quizzes by teacher
 */
quizSchema.statics.getByTeacher = function(teacherId) {
    return this.find({ createdBy: teacherId })
        .populate('category', 'name icon color')
        .sort({ updatedAt: -1 });
};

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Update category quiz count when quiz is saved
 */
quizSchema.post('save', async function() {
    const Category = mongoose.model('Category');
    await Category.updateQuizCount(this.category);
});

/**
 * Update category quiz count when quiz is removed
 */
quizSchema.post('remove', async function() {
    const Category = mongoose.model('Category');
    await Category.updateQuizCount(this.category);
    
    // Also remove all questions
    const Question = mongoose.model('Question');
    await Question.deleteMany({ quiz: this._id });
});

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
