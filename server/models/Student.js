const mongoose = require('mongoose');

/**
 * Student Schema
 * Stores student profiles for quiz participation (no authentication required)
 */
const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    
    avatar: {
        type: String,
        required: [true, 'Avatar is required'],
        default: 'avatar-1'
    },
    
    className: {
        type: String,
        trim: true,
        maxlength: [100, 'Class name too long'],
        default: ''
    },
    
    // Quizzes this student has taken
    quizzesTaken: [{
        quiz: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz'
        },
        takenAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Track which teacher created the quiz this student joined
    // This allows teachers to see "their" students
    associatedTeachers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Total number of quizzes taken
    totalQuizzes: {
        type: Number,
        default: 0
    },
    
    // Average score across all quizzes
    averageScore: {
        type: Number,
        default: 0
    },
    
    // Last quiz activity
    lastActive: {
        type: Date,
        default: Date.now
    }
    
}, {
    timestamps: true
});

// =============================================================================
// INDEXES
// =============================================================================

studentSchema.index({ email: 1 });
studentSchema.index({ associatedTeachers: 1 });
studentSchema.index({ lastActive: -1 });

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Add a quiz to student's history
 */
studentSchema.methods.addQuiz = async function(quizId, teacherId) {
    // Check if quiz already in history
    const exists = this.quizzesTaken.find(q => q.quiz.toString() === quizId.toString());
    
    if (!exists) {
        this.quizzesTaken.push({
            quiz: quizId,
            takenAt: new Date()
        });
        this.totalQuizzes += 1;
    }
    
    // Add teacher to associated teachers if not already there
    if (!this.associatedTeachers.includes(teacherId)) {
        this.associatedTeachers.push(teacherId);
    }
    
    this.lastActive = new Date();
    await this.save();
};

/**
 * Update average score
 */
studentSchema.methods.updateAverageScore = async function() {
    const Result = mongoose.model('Result');
    const results = await Result.find({ 
        student: this._id 
    });
    
    if (results.length > 0) {
        const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0);
        this.averageScore = Math.round(totalPercentage / results.length);
        await this.save();
    }
};

/**
 * Get public profile
 */
studentSchema.methods.toPublicProfile = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        avatar: this.avatar,
        className: this.className,
        totalQuizzes: this.totalQuizzes,
        averageScore: this.averageScore,
        lastActive: this.lastActive
    };
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Find student by email
 */
studentSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

/**
 * Get students for a specific teacher
 */
studentSchema.statics.getByTeacher = function(teacherId) {
    return this.find({ associatedTeachers: teacherId })
        .sort({ lastActive: -1 });
};

/**
 * Get students who took a specific quiz
 */
studentSchema.statics.getByQuiz = async function(quizId) {
    const Result = mongoose.model('Result');
    const results = await Result.find({ quiz: quizId })
        .populate('student')
        .select('student percentage score completedAt');
    
    // Extract unique students with their best scores
    const studentMap = new Map();
    results.forEach(result => {
        if (result.student) {
            const studentId = result.student._id.toString();
            if (!studentMap.has(studentId) || result.percentage > studentMap.get(studentId).percentage) {
                studentMap.set(studentId, {
                    ...result.student.toPublicProfile(),
                    score: result.percentage,
                    lastAttempt: result.completedAt
                });
            }
        }
    });
    
    return Array.from(studentMap.values());
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
