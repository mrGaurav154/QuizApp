/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user roles
 */

/**
 * Check if user has required role(s)
 * @param {string|string[]} allowedRoles - Role(s) that can access the route
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
    // Ensure allowedRoles is an array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        // Check if user exists (auth middleware should run first)
        // Support both req.user (from database) and req.userRole (from session/dummy users)
        const userRole = req.user?.role || req.userRole;
        
        if (!userRole) {
            return res.status(401).json({
                error: 'Authentication required.'
            });
        }
        
        // Check if user's role is in allowed roles
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.',
                required: roles,
                current: userRole
            });
        }

        next();
    };
};

/**
 * Admin only access
 */
const adminOnly = requireRole('admin');

/**
 * Teacher only access
 */
const teacherOnly = requireRole('teacher');

/**
 * Admin or Teacher access
 */
const adminOrTeacher = requireRole(['admin', 'teacher']);

module.exports = {
    requireRole,
    adminOnly,
    teacherOnly,
    adminOrTeacher
};
