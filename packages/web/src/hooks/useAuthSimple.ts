import { useState, useEffect, useCallback } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';

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

interface SignupData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

export const useAuthSimple = () => {
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    error,
    setUser, 
    setLoading, 
    setError, 
    clearError 
  } = useAuthStore();

  const [initializing, setInitializing] = useState(true);

  // Monitor de estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      try {
        if (firebaseUser) {
          // Converter Firebase User para AuthUser
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            emailVerified: firebaseUser.emailVerified,
            phoneNumber: firebaseUser.phoneNumber || undefined,
            customClaims: {
              role: 'user', // Default role
              permissions: ['read'],
              tenantId: 'default'
            },
            metadata: {
              creationTime: firebaseUser.metadata.creationTime || new Date().toISOString(),
              lastSignInTime: firebaseUser.metadata.lastSignInTime || new Date().toISOString()
            }
          };
          
          setUser(authUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error processing auth state:', error);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
        if (initializing) setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing, setUser, setLoading, setError]);

  // Login
  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    clearError();

    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  // Signup
  const signup = useCallback(async (data: SignupData) => {
    setLoading(true);
    clearError();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      if (data.displayName) {
        // Update profile with display name (simplified)
        await userCredential.user.reload();
      }
      
      toast.success('Conta criada com sucesso!');
      return userCredential.user;
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);
    clearError();

    try {
      await signOut(auth);
      toast.success('Logout realizado com sucesso!');
    } catch (error: any) {
      const errorMessage = 'Erro ao fazer logout';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  // Reset de senha
  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    clearError();

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de recuperação enviado!');
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  // Login com Google
  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    clearError();

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      toast.success('Login com Google realizado com sucesso!');
      return result.user;
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  return {
    user,
    isLoading: isLoading || initializing,
    isAuthenticated,
    error,
    login,
    loginWithGoogle,
    signup,
    logout,
    resetPassword,
    clearError,
  };
};

function getAuthErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Conta desabilitada',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/email-already-in-use': 'Email já está em uso',
    'auth/weak-password': 'Senha muito fraca',
    'auth/network-request-failed': 'Erro de conexão',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
    'auth/operation-not-allowed': 'Operação não permitida',
    'auth/invalid-credential': 'Credenciais inválidas',
  };

  return errorMessages[errorCode] || 'Erro de autenticação';
}