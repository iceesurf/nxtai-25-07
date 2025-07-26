"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireOrganizationAccess = exports.requireOrganization = exports.requireRole = exports.requirePermission = exports.authMiddleware = void 0;
const index_1 = require("../index");
const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header',
            });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing authentication token',
            });
            return;
        }
        // Verify the Firebase ID token
        const decodedToken = await index_1.auth.verifyIdToken(token);
        // Get user data from Firestore
        const userDoc = await index_1.db.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found in database',
            });
            return;
        }
        const userData = userDoc.data();
        // Check if user is active
        if ((userData === null || userData === void 0 ? void 0 : userData.status) !== 'active') {
            res.status(403).json({
                error: 'Forbidden',
                message: 'User account is not active',
            });
            return;
        }
        // Attach user data to request
        req.user = Object.assign(Object.assign({}, decodedToken), { organizationId: userData === null || userData === void 0 ? void 0 : userData.organizationId, role: userData === null || userData === void 0 ? void 0 : userData.role, permissions: (userData === null || userData === void 0 ? void 0 : userData.permissions) || [] });
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        if (error.code === 'auth/id-token-expired') {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Token expired',
            });
            return;
        }
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Token revoked',
            });
            return;
        }
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authentication token',
        });
    }
};
exports.authMiddleware = authMiddleware;
// Middleware to check specific permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
            return;
        }
        const userPermissions = req.user.permissions || [];
        const userRole = req.user.role;
        // Super admin has all permissions
        if (userRole === 'superadmin') {
            next();
            return;
        }
        // Check if user has the specific permission
        if (!userPermissions.includes(permission)) {
            res.status(403).json({
                error: 'Forbidden',
                message: `Permission '${permission}' required`,
            });
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
// Middleware to check role hierarchy
const requireRole = (minRole) => {
    const roleHierarchy = {
        viewer: 0,
        agent: 1,
        manager: 2,
        admin: 3,
        superadmin: 4,
    };
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
            return;
        }
        const userRole = req.user.role;
        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredRoleLevel = roleHierarchy[minRole] || 0;
        if (userRoleLevel < requiredRoleLevel) {
            res.status(403).json({
                error: 'Forbidden',
                message: `Role '${minRole}' or higher required`,
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Middleware to ensure user belongs to organization
const requireOrganization = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
        });
        return;
    }
    if (!req.user.organizationId) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'User must belong to an organization',
        });
        return;
    }
    next();
};
exports.requireOrganization = requireOrganization;
// Middleware to check organization ownership
const requireOrganizationAccess = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
        });
        return;
    }
    const orgId = req.params.orgId || req.body.organizationId || req.query.organizationId;
    // Super admin can access any organization
    if (req.user.role === 'superadmin') {
        next();
        return;
    }
    // Check if user belongs to the requested organization
    if (req.user.organizationId !== orgId) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied to this organization',
        });
        return;
    }
    next();
};
exports.requireOrganizationAccess = requireOrganizationAccess;
// Optional authentication middleware (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        if (!token) {
            next();
            return;
        }
        const decodedToken = await index_1.auth.verifyIdToken(token);
        const userDoc = await index_1.db.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            req.user = Object.assign(Object.assign({}, decodedToken), { organizationId: userData === null || userData === void 0 ? void 0 : userData.organizationId, role: userData === null || userData === void 0 ? void 0 : userData.role, permissions: (userData === null || userData === void 0 ? void 0 : userData.permissions) || [] });
        }
        next();
    }
    catch (error) {
        // Ignore authentication errors for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=authMiddleware.js.map