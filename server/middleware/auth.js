const User = require('../models/User');

/**
 * Authentication Middleware
 * Uses SESSION-BASED authentication (checks req.session)
 */

/**
 * Require authentication
 * Blocks request if user is not logged in
 */
const auth = async (req, res, next) => {
    try {
        // Check if session exists
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                error: 'Access denied. Please log in.'
            });
        }
        
        // Handle dummy users (for testing)
        if (req.session.userId === 'dummy-teacher-id-123' || 
            req.session.userId === 'dummy-admin-id-456') {
            req.userId = req.session.userId;
            req.userRole = req.session.role;
            return next();
        }
        
        // Get user from database to ensure they still exist and are active
        const user = await User.findById(req.session.userId).select('-password');
        
        if (!user) {
            // User was deleted - destroy session
            req.session.destroy();
            return res.status(401).json({
                error: 'Session invalid. Please log in again.'
            });
        }
        
        if (!user.isActive) {
            req.session.destroy();
            return res.status(403).json({
                error: 'Your account has been deactivated.'
            });
        }
        
        // Attach user to request
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
        
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Authentication failed.'
        });
    }
};

/**
 * Optional Authentication Middleware
 * Attaches user if logged in, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        if (req.session && req.session.userId) {
            // Handle dummy users
            if (req.session.userId === 'dummy-teacher-id-123' || 
                req.session.userId === 'dummy-admin-id-456') {
                req.userId = req.session.userId;
                req.userRole = req.session.role;
                return next();
            }
            
            const user = await User.findById(req.session.userId).select('-password');
            
            if (user && user.isActive) {
                req.user = user;
                req.userId = user._id;
                req.userRole = user.role;
            }
        }
        
        next();
        
    } catch (error) {
        // Silently continue without authentication
        next();
    }
};

/**
 * Require specific role
 * Use after auth middleware
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({
                error: 'Not authenticated'
            });
        }
        
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }
        
        next();
    };
};

module.exports = { auth, optionalAuth, requireRole };
