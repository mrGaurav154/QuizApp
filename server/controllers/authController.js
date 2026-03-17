const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Auth Controller
 * Handles user authentication (register, login, logout, etc.)
 */

// =============================================================================
// REGISTER
// =============================================================================

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role, institution, organization } = req.body;

        console.log('📝 Registration attempt:', { email, role });

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                error: 'User with this email already exists'
            });
        }

        // Validate role
        if (!['teacher', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Must be teacher or admin'
            });
        }

        // Create user with plain password
        // The User model's pre-save middleware will automatically hash it
        const user = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password, // Plain password - will be hashed by pre-save hook
            role,
            institution: role === 'teacher' ? institution : undefined,
            organization: role === 'admin' ? organization : undefined
        });

        await user.save();

        console.log('✅ User registered:', user.email);

        // Create session
        req.session.userId = user._id.toString();
        req.session.userRole = user.role;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    error: 'Failed to create session'
                });
            }

            res.status(201).json({
                message: 'User registered successfully',
                user: user.toPublicProfile()
            });
        });

    } catch (error) {
        console.error('❌ Registration error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                error: 'User with this email already exists'
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                error: messages[0] || 'Validation error'
            });
        }

        res.status(500).json({
            error: 'Registration failed. Please try again.'
        });
    }
};

// =============================================================================
// LOGIN
// =============================================================================

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        console.log('🔐 Login attempt:', { email, role });

        // IMPORTANT: Use .select('+password') to include the password field
        // because it has select: false in the schema
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        console.log('✅ User found:', user.email);

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                error: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Verify role if provided
        if (role && user.role !== role) {
            console.log('❌ Role mismatch:', { expected: role, actual: user.role });
            return res.status(403).json({
                error: `This account is registered as ${user.role}, not ${role}`
            });
        }

        // Verify password using the model's comparePassword method
        const isMatch = await user.comparePassword(password);
        
        console.log('Password comparison result:', isMatch);

        if (!isMatch) {
            console.log('❌ Password mismatch for user:', email);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        console.log('✅ User logged in successfully:', user.email);

        // Create session
        req.session.userId = user._id.toString();
        req.session.userRole = user.role;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    error: 'Failed to create session'
                });
            }

            res.json({
                message: 'Login successful',
                user: user.toPublicProfile()
            });
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Login failed. Please try again.'
        });
    }
};

// =============================================================================
// LOGOUT
// =============================================================================

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    try {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.status(500).json({
                        error: 'Failed to logout'
                    });
                }

                res.clearCookie('connect.sid');
                res.json({
                    message: 'Logout successful'
                });
            });
        } else {
            res.json({
                message: 'Already logged out'
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout'
        });
    }
};

// =============================================================================
// CHECK AUTH
// =============================================================================

/**
 * Check if user is authenticated
 * GET /api/auth/check
 */
const checkAuth = async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const user = await User.findById(req.session.userId).select('-password');
            
            if (!user) {
                return res.json({
                    authenticated: false
                });
            }

            res.json({
                authenticated: true,
                user: user.toPublicProfile()
            });
        } else {
            res.json({
                authenticated: false
            });
        }
    } catch (error) {
        console.error('Check auth error:', error);
        res.json({
            authenticated: false
        });
    }
};

// =============================================================================
// GET CURRENT USER
// =============================================================================

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
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
        console.error('Get current user error:', error);
        res.status(500).json({
            error: 'Failed to get user'
        });
    }
};

// =============================================================================
// CHANGE PASSWORD
// =============================================================================

/**
 * Change user password
 * PUT /api/auth/password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'New password must be at least 6 characters long'
            });
        }

        // Get user with password field
        const user = await User.findById(req.userId).select('+password');

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Verify current password using comparePassword method
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(401).json({
                error: 'Current password is incorrect'
            });
        }

        // Set new password (pre-save hook will hash it)
        user.password = newPassword;
        await user.save();

        console.log('✅ Password changed for user:', user.email);

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Failed to change password'
        });
    }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    register,
    login,
    logout,
    checkAuth,
    getCurrentUser,
    changePassword
};
