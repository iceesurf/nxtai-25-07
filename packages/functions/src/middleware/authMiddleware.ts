import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../index';
import { DecodedIdToken } from 'firebase-admin/auth';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken & {
        organizationId?: string;
        role?: string;
        permissions?: string[];
      };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const decodedToken = await auth.verifyIdToken(token);
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in database',
      });
      return;
    }

    const userData = userDoc.data();
    
    // Check if user is active
    if (userData?.status !== 'active') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'User account is not active',
      });
      return;
    }

    // Attach user data to request
    req.user = {
      ...decodedToken,
      organizationId: userData?.organizationId,
      role: userData?.role,
      permissions: userData?.permissions || [],
    };

    next();
  } catch (error) {
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

// Middleware to check specific permissions
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

// Middleware to check role hierarchy
export const requireRole = (minRole: string) => {
  const roleHierarchy = {
    viewer: 0,
    agent: 1,
    manager: 2,
    admin: 3,
    superadmin: 4,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
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

// Middleware to ensure user belongs to organization
export const requireOrganization = (req: Request, res: Response, next: NextFunction): void => {
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

// Middleware to check organization ownership
export const requireOrganizationAccess = (req: Request, res: Response, next: NextFunction): void => {
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

// Optional authentication middleware (for public endpoints that can benefit from user context)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const decodedToken = await auth.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      req.user = {
        ...decodedToken,
        organizationId: userData?.organizationId,
        role: userData?.role,
        permissions: userData?.permissions || [],
      };
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

