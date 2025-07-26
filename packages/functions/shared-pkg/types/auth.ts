export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  customClaims?: UserClaims;
}

export interface UserClaims {
  role: UserRole;
  permissions: Permission[];
  organizationId?: string;
  planType: PlanType;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent' | 'viewer';

export type Permission = 
  | 'users.read'
  | 'users.write'
  | 'users.delete'
  | 'agents.read'
  | 'agents.write'
  | 'agents.delete'
  | 'conversations.read'
  | 'conversations.write'
  | 'analytics.read'
  | 'settings.read'
  | 'settings.write'
  | 'billing.read'
  | 'billing.write';

export type PlanType = 'free' | 'basic' | 'pro' | 'enterprise';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupData {
  email: string;
  password: string;
  displayName: string;
  organizationName?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}