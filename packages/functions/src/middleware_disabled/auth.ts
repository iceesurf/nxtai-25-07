import { getAuth } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';
import { Permission, UserRole } from '@nxtai/shared';
import { logger } from '../utils/logger';

const auth = getAuth();

export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  permissions: Permission[];
  planType: string;
}

export async function validateAuth(
  idToken: string, 
  requiredPermissions?: Permission[]
): Promise<AuthContext> {
  try {
    // Verificar token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    if (!decodedToken.uid) {
      throw new HttpsError('unauthenticated', 'Invalid authentication token');
    }

    // Obter custom claims
    const userRecord = await auth.getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims as any;

    if (!customClaims?.role) {
      throw new HttpsError('permission-denied', 'User role not found');
    }

    const authContext: AuthContext = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: customClaims.role,
      organizationId: customClaims.organizationId,
      permissions: customClaims.permissions || [],
      planType: customClaims.planType || 'free',
    };

    // Verificar permissões se especificadas
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some(permission => 
        authContext.permissions.includes(permission)
      );

      if (!hasPermission) {
        throw new HttpsError(
          'permission-denied', 
          `Required permissions: ${requiredPermissions.join(', ')}`
        );
      }
    }

    logger.debug('Authentication validated', {
      uid: authContext.uid,
      role: authContext.role,
      organizationId: authContext.organizationId,
    });

    return authContext;

  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error('Authentication validation failed', error);
    throw new HttpsError('unauthenticated', 'Authentication failed');
  }
}

export function requireAuth(requiredPermissions?: Permission[]) {
  return async (idToken: string) => {
    return validateAuth(idToken, requiredPermissions);
  };
}

export function requireRole(roles: UserRole[]) {
  return async (idToken: string) => {
    const authContext = await validateAuth(idToken);
    
    if (!roles.includes(authContext.role)) {
      throw new HttpsError(
        'permission-denied', 
        `Required roles: ${roles.join(', ')}`
      );
    }

    return authContext;
  };
}

export function requireOrganization() {
  return async (idToken: string) => {
    const authContext = await validateAuth(idToken);
    
    if (!authContext.organizationId) {
      throw new HttpsError(
        'permission-denied', 
        'Organization context required'
      );
    }

    return authContext;
  };
}

export async function checkPlanLimits(
  organizationId: string, 
  resource: 'users' | 'agents' | 'conversations' | 'messages',
  count: number = 1
): Promise<boolean> {
  try {
    // TODO: Implementar verificação de limites baseada no plano
    // Por enquanto, retorna true
    return true;
  } catch (error) {
    logger.error('Error checking plan limits', error);
    return false;
  }
}