import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  customClaims?: {
    role?: string;
    permissions?: string[];
    tenantId?: string;
  };
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthStore extends AuthState {
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: string[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        error: null 
      }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      hasPermission: (permission) => {
        const { user } = get();
        if (!user?.customClaims?.permissions) return false;
        return user.customClaims.permissions.includes(permission);
      },

      hasRole: (roles) => {
        const { user } = get();
        if (!user?.customClaims?.role) return false;
        return roles.includes(user.customClaims.role);
      },
    }),
    {
      name: 'nxtai-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);