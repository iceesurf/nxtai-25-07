export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  customClaims?: {
    role?: string;
    permissions?: string[];
    tenantId?: string;
  };
}

export interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
  role?: string;
  phoneNumber?: string;
}

export interface UpdateUserData {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  role?: string;
  permissions?: string[];
}