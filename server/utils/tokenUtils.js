const jwt = require('jsonwebtoken');

/**
 * Generate Access Token
 * Short-lived token for API authentication
 * @param {Object} payload - User data to encode
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_123',
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );
};

/**
 * Generate Refresh Token
 * Long-lived token for obtaining new access tokens
 * @param {Object} payload - User data to encode
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_123',
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );
};

/**
 * Verify Access Token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_123');
};

/**
 * Verify Refresh Token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_123');
};

/**
 * Generate both tokens for a user
 * @param {Object} user - User document
 * @returns {Object} Object containing both tokens
 */
const generateTokenPair = (user) => {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role
    };
    
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokenPair
};
