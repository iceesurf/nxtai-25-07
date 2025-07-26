import { https } from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const adminAuth = admin.auth();

// Get current user data
export const getCurrentUser = https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userRecord = await adminAuth.getUser(context.auth.uid);
    
    // Get additional user data from Firestore if exists
    const userDoc = await db.collection('users').doc(context.auth!.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      emailVerified: userRecord.emailVerified,
      phoneNumber: userRecord.phoneNumber,
      customClaims: userRecord.customClaims || {},
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
      },
      ...userData
    };

    return {
      success: true,
      data: user
    };
  } catch (error) {
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
export const signup = https.onCall(async (data: any, context: any) => {
  try {
    const { email, password, displayName, phoneNumber } = data;

    if (!email || !password || !displayName) {
      throw new https.HttpsError('invalid-argument', 'Missing required fields');
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
  } catch (error: any) {
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
export const updateProfile = https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { displayName, photoURL, phoneNumber } = data;
    const updates: any = {};

    if (displayName !== undefined) updates.displayName = displayName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;

    // Update Firebase Auth
    await adminAuth.updateUser(context.auth!.uid, updates);

    // Update Firestore document
    await db.collection('users').doc(context.auth!.uid).update({
      ...updates,
      name: displayName || undefined,
      updatedAt: new Date()
    });

    return {
      success: true,
      data: { message: 'Profile updated successfully' }
    };
  } catch (error: any) {
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
export const deleteAccount = https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Delete from Firestore
    await db.collection('users').doc(context.auth!.uid).delete();

    // Delete from Firebase Auth
    await adminAuth.deleteUser(context.auth!.uid);

    return {
      success: true,
      data: { message: 'Account deleted successfully' }
    };
  } catch (error: any) {
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