import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { SignupData, LoginCredentials, UserRole, PlanType } from '@nxtai/shared';
import { logger } from '../utils/logger';
import { validateAuth } from '../middleware/auth';

const db = getFirestore();
const auth = getAuth();

// Schemas de validação
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  organizationName: z.string().optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(2).optional(),
  photoURL: z.string().url().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
});

export const signup = onCall(
  { 
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { data } = request;
      const validatedData = signupSchema.parse(data);

      logger.info('Starting user signup process', { email: validatedData.email });

      // Criar usuário no Firebase Auth
      const userRecord = await auth.createUser({
        email: validatedData.email,
        password: validatedData.password,
        displayName: validatedData.displayName,
        emailVerified: false,
      });

      // Determinar role e plano baseado na criação de organização
      const role: UserRole = validatedData.organizationName ? 'admin' : 'agent';
      const planType: PlanType = 'free';

      let organizationId: string | undefined;

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

      logger.info('User signup completed successfully', { 
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

    } catch (error) {
      logger.error('Error during signup', error);
      
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', 'Invalid input data', error.errors);
      }
      
      if (error.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Email already registered');
      }
      
      throw new HttpsError('internal', 'Signup failed');
    }
  }
);

export const updateProfile = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { data, auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const validatedData = updateProfileSchema.parse(data);

      logger.info('Updating user profile', { uid: authContext.uid });

      const updates: any = {
        updatedAt: new Date(),
        updatedBy: authContext.uid,
      };

      // Atualizar Firebase Auth se necessário
      if (validatedData.displayName || validatedData.photoURL) {
        await auth.updateUser(authContext.uid, {
          displayName: validatedData.displayName,
          photoURL: validatedData.photoURL,
        });
        
        if (validatedData.displayName) updates.displayName = validatedData.displayName;
      }

      // Atualizar preferências no Firestore
      if (validatedData.preferences) {
        updates['preferences'] = validatedData.preferences;
      }

      await db.collection('users').doc(authContext.uid).update(updates);

      logger.info('Profile updated successfully', { uid: authContext.uid });

      return {
        success: true,
        data: { updated: true },
      };

    } catch (error) {
      logger.error('Error updating profile', error);
      
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', 'Invalid input data', error.errors);
      }
      
      throw new HttpsError('internal', 'Profile update failed');
    }
  }
);

export const getCurrentUser = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userDoc = await db.collection('users').doc(authContext.uid).get();
      
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found');
      }

      const userData = userDoc.data();
      const authUser = await auth.getUser(authContext.uid);

      // Atualizar último login
      await db.collection('users').doc(authContext.uid).update({
        lastLoginAt: new Date(),
        loginCount: (userData?.loginCount || 0) + 1,
      });

      return {
        success: true,
        data: {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          emailVerified: authUser.emailVerified,
          ...userData,
          customClaims: authUser.customClaims,
        },
      };

    } catch (error) {
      logger.error('Error getting current user', error);
      throw new HttpsError('internal', 'Failed to get user data');
    }
  }
);

export const deleteAccount = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      logger.info('Starting account deletion', { uid: authContext.uid });

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

      logger.info('Account deleted successfully', { uid: authContext.uid });

      return {
        success: true,
        data: { deleted: true },
      };

    } catch (error) {
      logger.error('Error deleting account', error);
      throw new HttpsError('internal', 'Account deletion failed');
    }
  }
);

function getPermissionsForRole(role: UserRole) {
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