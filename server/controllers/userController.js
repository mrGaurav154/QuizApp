const User = require('../models/User');

/**
 * User Controller
 * Handles user profile management and admin operations
 */

// =============================================================================
// PROFILE MANAGEMENT
// =============================================================================

/**
 * Get user profile
 * GET /api/users/profile
 */
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate('categories', 'name icon color');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        res.json({
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to get profile'
        });
    }
};

/**
 * Update user profile
 * PUT /api/users/profile
 */
const updateProfile = async (req, res) => {
    try {
        const { name, institution, organization, avatar } = req.body;
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Update allowed fields
        if (name) user.name = name;
        if (institution && user.role === 'teacher') user.institution = institution;
        if (organization && user.role === 'admin') user.organization = organization;
        if (avatar) user.avatar = avatar;
        
        await user.save();
        
        res.json({
            message: 'Profile updated successfully',
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            error: 'Failed to update profile'
        });
    }
};

// =============================================================================
// ONBOARDING
// =============================================================================

/**
 * Complete onboarding
 * PUT /api/users/onboarding
 */
const completeOnboarding = async (req, res) => {
    try {
        const { categories } = req.body;
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Update categories if provided (for teachers)
        if (categories && Array.isArray(categories)) {
            user.categories = categories;
        }
        
        user.onboardingCompleted = true;
        await user.save();
        
        res.json({
            message: 'Onboarding completed',
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Complete onboarding error:', error);
        res.status(500).json({
            error: 'Failed to complete onboarding'
        });
    }
};

// =============================================================================
// ADMIN: TEACHER MANAGEMENT
// =============================================================================

/**
 * Get all teachers (Admin only)
 * GET /api/users/teachers
 */
const getAllTeachers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        
        const query = { role: 'teacher' };
        
        // Apply search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { institution: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Apply status filter
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }
        
        const teachers = await User.find(query)
            .select('-password -refreshToken')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await User.countDocuments(query);
        
        res.json({
            teachers: teachers.map(t => t.toPublicProfile()),
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
        
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({
            error: 'Failed to get teachers'
        });
    }
};

/**
 * Get single teacher by ID (Admin only)
 * GET /api/users/teachers/:id
 */
const getTeacherById = async (req, res) => {
    try {
        const teacher = await User.findOne({ 
            _id: req.params.id, 
            role: 'teacher' 
        }).select('-password -refreshToken');
        
        if (!teacher) {
            return res.status(404).json({
                error: 'Teacher not found'
            });
        }
        
        res.json({
            teacher: teacher.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Get teacher error:', error);
        res.status(500).json({
            error: 'Failed to get teacher'
        });
    }
};

/**
 * Update teacher (Admin only)
 * PUT /api/users/teachers/:id
 */
const updateTeacher = async (req, res) => {
    try {
        const { name, institution, isActive } = req.body;
        
        const teacher = await User.findOne({ 
            _id: req.params.id, 
            role: 'teacher' 
        });
        
        if (!teacher) {
            return res.status(404).json({
                error: 'Teacher not found'
            });
        }
        
        // Update fields
        if (name) teacher.name = name;
        if (institution) teacher.institution = institution;
        if (typeof isActive === 'boolean') teacher.isActive = isActive;
        
        await teacher.save();
        
        res.json({
            message: 'Teacher updated successfully',
            teacher: teacher.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Update teacher error:', error);
        res.status(500).json({
            error: 'Failed to update teacher'
        });
    }
};

/**
 * Delete teacher (Admin only)
 * DELETE /api/users/teachers/:id
 */
const deleteTeacher = async (req, res) => {
    try {
        const teacher = await User.findOneAndDelete({ 
            _id: req.params.id, 
            role: 'teacher' 
        });
        
        if (!teacher) {
            return res.status(404).json({
                error: 'Teacher not found'
            });
        }
        
        // TODO: Optionally delete teacher's quizzes and results
        
        res.json({
            message: 'Teacher deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({
            error: 'Failed to delete teacher'
        });
    }
};

/**
 * Get dashboard stats (for current user)
 * GET /api/users/stats
 */
const getDashboardStats = async (req, res) => {
    try {
        const Quiz = require('../models/Quiz');
        const Result = require('../models/Result');
        
        const userId = req.userId;
        const user = req.user;
        
        let stats = {};
        
        if (user.role === 'teacher') {
            // Teacher stats
            const quizCount = await Quiz.countDocuments({ createdBy: userId });
            const publishedQuizCount = await Quiz.countDocuments({ 
                createdBy: userId, 
                isPublished: true 
            });
            
            const quizzes = await Quiz.find({ createdBy: userId }).select('_id');
            const quizIds = quizzes.map(q => q._id);
            
            const totalAttempts = await Result.countDocuments({ quiz: { $in: quizIds } });
            
            stats = {
                totalQuizzes: quizCount,
                publishedQuizzes: publishedQuizCount,
                draftQuizzes: quizCount - publishedQuizCount,
                totalAttempts
            };
            
        } else if (user.role === 'admin') {
            // Admin stats
            const teacherCount = await User.countDocuments({ role: 'teacher' });
            const quizCount = await Quiz.countDocuments();
            const resultCount = await Result.countDocuments();
            const Category = require('../models/Category');
            const categoryCount = await Category.countDocuments();
            
            stats = {
                totalTeachers: teacherCount,
                totalQuizzes: quizCount,
                totalAttempts: resultCount,
                totalCategories: categoryCount
            };
        }
        
        res.json({ stats });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            error: 'Failed to get stats'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    completeOnboarding,
    getAllTeachers,
    getTeacherById,
    updateTeacher,
    deleteTeacher,
    getDashboardStats
};
