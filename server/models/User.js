const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Supports Admin, Teacher, and Student roles
 */
const userSchema = new mongoose.Schema({
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
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    
    role: {
        type: String,
        enum: {
            values: ['admin', 'teacher', 'student'],
            message: '{VALUE} is not a valid role'
        },
        default: 'teacher'
    },
    
    // Teacher-specific field
    institution: {
        type: String,
        trim: true,
        maxlength: [200, 'Institution name too long']
    },
    
    // Admin-specific field
    organization: {
        type: String,
        trim: true,
        maxlength: [200, 'Organization name too long']
    },
    
    // Categories the user is interested in (for teachers)
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    
    // Onboarding status
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    
    // Refresh token for JWT refresh flow
    refreshToken: {
        type: String,
        select: false
    },
    
    // Avatar/Profile picture URL
    avatar: {
        type: String,
        default: ''
    },
    
    // Account status
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Last login timestamp
    lastLogin: {
        type: Date
    }
    
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// =============================================================================
// INDEXES
// =============================================================================

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

/**
 * Hash password before saving
 */
userSchema.pre('save', async function(next) {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// INSTANCE METHODS
// =============================================================================

/**
 * Compare password with hashed password
 * @param {string} candidatePassword - Password to compare
 * @returns {boolean} True if passwords match
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Get public profile (without sensitive data)
 * @returns {Object} Public user data
 */
userSchema.methods.toPublicProfile = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        institution: this.institution,
        organization: this.organization,
        avatar: this.avatar,
        onboardingCompleted: this.onboardingCompleted,
        createdAt: this.createdAt
    };
};

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Find user by email with password field
 * @param {string} email - User email
 * @returns {User} User document with password
 */
userSchema.statics.findByEmailWithPassword = function(email) {
    return this.findOne({ email }).select('+password');
};

/**
 * Find user by refresh token
 * @param {string} token - Refresh token
 * @returns {User} User document
 */
userSchema.statics.findByRefreshToken = function(token) {
    return this.findOne({ refreshToken: token }).select('+refreshToken');
};

const User = mongoose.model('User', userSchema);

module.exports = User;
