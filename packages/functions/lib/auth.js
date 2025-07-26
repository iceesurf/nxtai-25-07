"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateProfile = exports.signup = exports.getCurrentUser = void 0;
const firebase_functions_1 = require("firebase-functions");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const adminAuth = admin.auth();
// Get current user data
exports.getCurrentUser = firebase_functions_1.https.onCall(async (data, context) => {
    try {
        if (!(context === null || context === void 0 ? void 0 : context.auth)) {
            throw new firebase_functions_1.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const userRecord = await adminAuth.getUser(context.auth.uid);
        // Get additional user data from Firestore if exists
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const user = Object.assign({ uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName, photoURL: userRecord.photoURL, emailVerified: userRecord.emailVerified, phoneNumber: userRecord.phoneNumber, customClaims: userRecord.customClaims || {}, metadata: {
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
            } }, userData);
        return {
            success: true,
            data: user
        };
    }
    catch (error) {
        console.error('Error getting current user:', error);
        return {
            success: false,
            error: {
                code: 'internal',
                message: 'Failed to get user data'
            }
        };
    }
});
// Create new user with custom data
exports.signup = firebase_functions_1.https.onCall(async (data, context) => {
    try {
        const { email, password, displayName, phoneNumber } = data;
        if (!email || !password || !displayName) {
            throw new firebase_functions_1.https.HttpsError('invalid-argument', 'Missing required fields');
        }
        // Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName,
            phoneNumber,
            emailVerified: false
        });
        // Create user document in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            email,
            name: displayName,
            displayName,
            phoneNumber,
            role: 'viewer', // Default role
            tenantId: 'default',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active'
        });
        // Set custom claims
        await adminAuth.setCustomUserClaims(userRecord.uid, {
            role: 'viewer',
            permissions: ['read'],
            tenantId: 'default'
        });
        return {
            success: true,
            data: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName
            }
        };
    }
    catch (error) {
        console.error('Error creating user:', error);
        return {
            success: false,
            error: {
                code: error.code || 'internal',
                message: error.message || 'Failed to create user'
            }
        };
    }
});
// Update user profile
exports.updateProfile = firebase_functions_1.https.onCall(async (data, context) => {
    try {
        if (!(context === null || context === void 0 ? void 0 : context.auth)) {
            throw new firebase_functions_1.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const { displayName, photoURL, phoneNumber } = data;
        const updates = {};
        if (displayName !== undefined)
            updates.displayName = displayName;
        if (photoURL !== undefined)
            updates.photoURL = photoURL;
        if (phoneNumber !== undefined)
            updates.phoneNumber = phoneNumber;
        // Update Firebase Auth
        await adminAuth.updateUser(context.auth.uid, updates);
        // Update Firestore document
        await db.collection('users').doc(context.auth.uid).update(Object.assign(Object.assign({}, updates), { name: displayName || undefined, updatedAt: new Date() }));
        return {
            success: true,
            data: { message: 'Profile updated successfully' }
        };
    }
    catch (error) {
        console.error('Error updating profile:', error);
        return {
            success: false,
            error: {
                code: error.code || 'internal',
                message: error.message || 'Failed to update profile'
            }
        };
    }
});
// Delete user account
exports.deleteAccount = firebase_functions_1.https.onCall(async (data, context) => {
    try {
        if (!(context === null || context === void 0 ? void 0 : context.auth)) {
            throw new firebase_functions_1.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        // Delete from Firestore
        await db.collection('users').doc(context.auth.uid).delete();
        // Delete from Firebase Auth
        await adminAuth.deleteUser(context.auth.uid);
        return {
            success: true,
            data: { message: 'Account deleted successfully' }
        };
    }
    catch (error) {
        console.error('Error deleting account:', error);
        return {
            success: false,
            error: {
                code: error.code || 'internal',
                message: error.message || 'Failed to delete account'
            }
        };
    }
});
//# sourceMappingURL=auth.js.map