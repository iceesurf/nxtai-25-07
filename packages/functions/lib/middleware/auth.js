"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireOrganization = requireOrganization;
exports.checkPlanLimits = checkPlanLimits;
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const logger_1 = require("../utils/logger");
const auth = (0, auth_1.getAuth)();
async function validateAuth(idToken, requiredPermissions) {
    try {
        // Verificar token
        const decodedToken = await auth.verifyIdToken(idToken);
        if (!decodedToken.uid) {
            throw new https_1.HttpsError('unauthenticated', 'Invalid authentication token');
        }
        // Obter custom claims
        const userRecord = await auth.getUser(decodedToken.uid);
        const customClaims = userRecord.customClaims;
        if (!(customClaims === null || customClaims === void 0 ? void 0 : customClaims.role)) {
            throw new https_1.HttpsError('permission-denied', 'User role not found');
        }
        const authContext = {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
            role: customClaims.role,
            organizationId: customClaims.organizationId,
            permissions: customClaims.permissions || [],
            planType: customClaims.planType || 'free',
        };
        // Verificar permissões se especificadas
        if (requiredPermissions && requiredPermissions.length > 0) {
            const hasPermission = requiredPermissions.some(permission => authContext.permissions.includes(permission));
            if (!hasPermission) {
                throw new https_1.HttpsError('permission-denied', `Required permissions: ${requiredPermissions.join(', ')}`);
            }
        }
        logger_1.logger.debug('Authentication validated', {
            uid: authContext.uid,
            role: authContext.role,
            organizationId: authContext.organizationId,
        });
        return authContext;
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        logger_1.logger.error('Authentication validation failed', error);
        throw new https_1.HttpsError('unauthenticated', 'Authentication failed');
    }
}
function requireAuth(requiredPermissions) {
    return async (idToken) => {
        return validateAuth(idToken, requiredPermissions);
    };
}
function requireRole(roles) {
    return async (idToken) => {
        const authContext = await validateAuth(idToken);
        if (!roles.includes(authContext.role)) {
            throw new https_1.HttpsError('permission-denied', `Required roles: ${roles.join(', ')}`);
        }
        return authContext;
    };
}
function requireOrganization() {
    return async (idToken) => {
        const authContext = await validateAuth(idToken);
        if (!authContext.organizationId) {
            throw new https_1.HttpsError('permission-denied', 'Organization context required');
        }
        return authContext;
    };
}
async function checkPlanLimits(organizationId, resource, count = 1) {
    try {
        // TODO: Implementar verificação de limites baseada no plano
        // Por enquanto, retorna true
        return true;
    }
    catch (error) {
        logger_1.logger.error('Error checking plan limits', error);
        return false;
    }
}
//# sourceMappingURL=auth.js.map