import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types/user';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Buscar dados do usuário no Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUserData(userData);
          } else {
            // Se não existe documento do usuário, criar um básico
            const basicUserData: Partial<User> = {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL,
              organizationId: '', // Será definido durante o onboarding
              role: 'viewer',
              permissions: [],
              status: 'active',
              isEmailVerified: user.emailVerified,
              preferences: {
                language: 'pt-BR',
                timezone: 'America/Sao_Paulo',
                notifications: {
                  email: true,
                  push: true,
                  sms: false,
                  leadAssigned: true,
                  leadStatusChanged: true,
                  newMessage: true,
                  taskDue: true,
                  campaignCompleted: true,
                },
                dashboard: {
                  widgets: [],
                  layout: 'grid',
                  refreshInterval: 300000,
                },
              },
              loginCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            await setDoc(doc(db, 'users', user.uid), basicUserData);
            setUserData(basicUserData as User);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Atualizar contador de login
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const currentData = userDoc.data();
          await setDoc(userRef, {
            ...currentData,
            loginCount: (currentData.loginCount || 0) + 1,
            lastLogin: new Date(),
            updatedAt: new Date(),
          }, { merge: true });
        }
      }
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string): Promise<void> => {
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Atualizar perfil do Firebase Auth
      await updateProfile(result.user, {
        displayName: displayName,
      });

      // Criar documento do usuário no Firestore
      const userData: Partial<User> = {
        id: result.user.uid,
        email: email,
        displayName: displayName,
        organizationId: '', // Será definido durante o onboarding
        role: 'viewer',
        permissions: [],
        status: 'active',
        isEmailVerified: false,
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          notifications: {
            email: true,
            push: true,
            sms: false,
            leadAssigned: true,
            leadStatusChanged: true,
            newMessage: true,
            taskDue: true,
            campaignCompleted: true,
          },
          dashboard: {
            widgets: [],
            layout: 'grid',
            refreshInterval: 300000,
          },
        },
        loginCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', result.user.uid), userData);
      setUserData(userData as User);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUserData(null);
    } catch (error: any) {
      throw new Error('Erro ao fazer logout');
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!currentUser || !userData) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedData = {
        ...data,
        updatedAt: new Date(),
      };

      await setDoc(userRef, updatedData, { merge: true });
      
      // Atualizar estado local
      setUserData(prev => prev ? { ...prev, ...updatedData } : null);

      // Atualizar perfil do Firebase Auth se necessário
      if (data.displayName && data.displayName !== currentUser.displayName) {
        await updateProfile(currentUser, {
          displayName: data.displayName,
        });
      }
    } catch (error: any) {
      throw new Error('Erro ao atualizar perfil');
    }
  };

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Função auxiliar para traduzir erros do Firebase
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'Usuário não encontrado';
    case 'auth/wrong-password':
      return 'Senha incorreta';
    case 'auth/email-already-in-use':
      return 'Este email já está em uso';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres';
    case 'auth/invalid-email':
      return 'Email inválido';
    case 'auth/user-disabled':
      return 'Esta conta foi desabilitada';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet';
    default:
      return 'Erro de autenticação. Tente novamente';
  }
}

