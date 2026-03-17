const mongoose = require('mongoose');

/**
 * Category Schema
 * Organizes quizzes into categories (GK, Aptitude, Coding, etc.)
 */
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        unique: true,
        trim: true,
        minlength: [2, 'Category name must be at least 2 characters'],
        maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: ''
    },
    
    // Lucide icon name (e.g., 'book-open', 'code', 'brain')
    icon: {
        type: String,
        trim: true,
        default: 'folder'
    },
    
    // Color for UI display (hex code)
    color: {
        type: String,
        trim: true,
        default: '#6366f1',
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format']
    },
    
    // Who created this category
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Visibility status
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Number of quizzes in this category (virtual, for display)
    quizCount: {
        type: Number,
        default: 0
    }
    
}, {
    timestamps: true
});

// =============================================================================
// INDEXES
// =============================================================================

categorySchema.index({ isActive: 1 });
categorySchema.index({ createdAt: -1 });

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Get all active categories
 */
categorySchema.statics.getActive = function() {
    return this.find({ isActive: true }).sort({ name: 1 });
};

/**
 * Update quiz count for a category
 */
categorySchema.statics.updateQuizCount = async function(categoryId) {
    const Quiz = mongoose.model('Quiz');
    const count = await Quiz.countDocuments({ category: categoryId, isPublished: true });
    return this.findByIdAndUpdate(categoryId, { quizCount: count }, { new: true });
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
