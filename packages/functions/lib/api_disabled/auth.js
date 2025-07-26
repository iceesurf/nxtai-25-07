"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.getCurrentUser = exports.updateProfile = exports.signup = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
// Schemas de validação
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(2),
    organizationName: zod_1.z.string().optional(),
});
const updateProfileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).optional(),
    photoURL: zod_1.z.string().url().optional(),
    preferences: zod_1.z.object({
        theme: zod_1.z.enum(['light', 'dark', 'system']).optional(),
        language: zod_1.z.string().optional(),
        timezone: zod_1.z.string().optional(),
    }).optional(),
});
exports.signup = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    try {
        const { data } = request;
        const validatedData = signupSchema.parse(data);
        logger_1.logger.info('Starting user signup process', { email: validatedData.email });
        // Criar usuário no Firebase Auth
        const userRecord = await auth.createUser({
            email: validatedData.email,
            password: validatedData.password,
            displayName: validatedData.displayName,
            emailVerified: false,
        });
        // Determinar role e plano baseado na criação de organização
        const role = validatedData.organizationName ? 'admin' : 'agent';
        const planType = 'free';
        let organizationId;
        // Se forneceu nome da organização, criar organização
        if (validatedData.organizationName) {
            const orgRef = db.collection('organizations').doc();
            organizationId = orgRef.id;
            await orgRef.set({
                id: organizationId,
                name: validatedData.organizationName,
                slug: validatedData.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                planType,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userRecord.uid,
                settings: {
                    allowedDomains: [validatedData.email.split('@')[1]],
                    ssoEnabled: false,
                    maxUsers: 5,
                    maxAgents: 1,
                    retentionDays: 30,
                },
                billing: {
                    planType,
                    billingCycle: 'monthly',
                    amount: 0,
                    currency: 'USD',
                },
                usage: {
                    currentPeriod: {
                        conversations: 0,
                        messages: 0,
                        users: 0,
                        agents: 0,
                    },
                    limits: {
                        conversations: 1000,
                        messages: 10000,
                        users: 5,
                        agents: 1,
                    },
                },
            });
        }
        // Criar perfil do usuário no Firestore
        await db.collection('users').doc(userRecord.uid).set({
            id: userRecord.uid,
            email: validatedData.email,
            displayName: validatedData.displayName,
            role,
            status: 'active',
            organizationId,
            planType,
            createdAt: new Date(),
            updatedAt: new Date(),
            loginCount: 0,
            preferences: {
                theme: 'system',
                language: 'pt-BR',
                timezone: 'America/Sao_Paulo',
                notifications: {
                    email: true,
                    push: true,
                    inApp: true,
                    types: {
                        newConversation: true,
                        agentError: true,
                        systemAlert: true,
                        weeklyReport: true,
                    },
                },
                dashboard: {
                    defaultView: 'overview',
                    widgets: [],
                },
            },
        });
        // Definir custom claims
        await auth.setCustomUserClaims(userRecord.uid, {
            role,
            organizationId,
            planType,
            permissions: getPermissionsForRole(role),
        });
        // Enviar email de verificação
        const link = await auth.generateEmailVerificationLink(validatedData.email);
        // TODO: Enviar email usando SendGrid
        logger_1.logger.info('User signup completed successfully', {
            uid: userRecord.uid,
            email: validatedData.email,
            organizationId,
        });
        return {
            success: true,
            data: {
                uid: userRecord.uid,
                email: validatedData.email,
                displayName: validatedData.displayName,
                organizationId,
                role,
                planType,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error during signup', error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid input data', error.errors);
        }
        if (error.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'Email already registered');
        }
        throw new https_1.HttpsError('internal', 'Signup failed');
    }
});
exports.updateProfile = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    try {
        const { data, auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        const validatedData = updateProfileSchema.parse(data);
        logger_1.logger.info('Updating user profile', { uid: authContext.uid });
        const updates = {
            updatedAt: new Date(),
            updatedBy: authContext.uid,
        };
        // Atualizar Firebase Auth se necessário
        if (validatedData.displayName || validatedData.photoURL) {
            await auth.updateUser(authContext.uid, {
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            });
            if (validatedData.displayName)
                updates.displayName = validatedData.displayName;
        }
        // Atualizar preferências no Firestore
        if (validatedData.preferences) {
            updates['preferences'] = validatedData.preferences;
        }
        await db.collection('users').doc(authContext.uid).update(updates);
        logger_1.logger.info('Profile updated successfully', { uid: authContext.uid });
        return {
            success: true,
            data: { updated: true },
        };
    }
    catch (error) {
        logger_1.logger.error('Error updating profile', error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid input data', error.errors);
        }
        throw new https_1.HttpsError('internal', 'Profile update failed');
    }
});
exports.getCurrentUser = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    try {
        const { auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        const userDoc = await db.collection('users').doc(authContext.uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User profile not found');
        }
        const userData = userDoc.data();
        const authUser = await auth.getUser(authContext.uid);
        // Atualizar último login
        await db.collection('users').doc(authContext.uid).update({
            lastLoginAt: new Date(),
            loginCount: ((userData === null || userData === void 0 ? void 0 : userData.loginCount) || 0) + 1,
        });
        return {
            success: true,
            data: Object.assign(Object.assign({ uid: authUser.uid, email: authUser.email, displayName: authUser.displayName, photoURL: authUser.photoURL, emailVerified: authUser.emailVerified }, userData), { customClaims: authUser.customClaims }),
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting current user', error);
        throw new https_1.HttpsError('internal', 'Failed to get user data');
    }
});
exports.deleteAccount = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    try {
        const { auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        logger_1.logger.info('Starting account deletion', { uid: authContext.uid });
        // Marcar usuário como deletado (soft delete)
        await db.collection('users').doc(authContext.uid).update({
            status: 'deleted',
            deletedAt: new Date(),
            updatedAt: new Date(),
        });
        // Anonimizar dados pessoais
        await auth.updateUser(authContext.uid, {
            displayName: 'Deleted User',
            photoURL: null,
            disabled: true,
        });
        // TODO: Implementar limpeza de dados relacionados
        // - Conversas
        // - Agentes
        // - Analytics
        logger_1.logger.info('Account deleted successfully', { uid: authContext.uid });
        return {
            success: true,
            data: { deleted: true },
        };
    }
    catch (error) {
        logger_1.logger.error('Error deleting account', error);
        throw new https_1.HttpsError('internal', 'Account deletion failed');
    }
});
function getPermissionsForRole(role) {
    const permissions = {
        super_admin: [
            'users.read', 'users.write', 'users.delete',
            'agents.read', 'agents.write', 'agents.delete',
            'conversations.read', 'conversations.write',
            'analytics.read', 'settings.read', 'settings.write',
            'billing.read', 'billing.write'
        ],
        admin: [
            'users.read', 'users.write',
            'agents.read', 'agents.write', 'agents.delete',
            'conversations.read', 'conversations.write',
            'analytics.read', 'settings.read', 'settings.write',
            'billing.read'
        ],
        manager: [
            'users.read',
            'agents.read', 'agents.write',
            'conversations.read', 'conversations.write',
            'analytics.read'
        ],
        agent: [
            'agents.read',
            'conversations.read', 'conversations.write'
        ],
        viewer: [
            'agents.read',
            'conversations.read',
            'analytics.read'
        ]
    };
    return permissions[role] || [];
}
//# sourceMappingURL=auth.js.map