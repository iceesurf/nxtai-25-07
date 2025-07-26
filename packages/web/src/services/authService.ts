import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types/user';

export class AuthService {
  async login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = await this.getUserData(userCredential.user.uid);
      const token = await userCredential.user.getIdToken();
      
      // Update last login
      if (user) {
        await updateDoc(doc(db, 'users', user.id), {
          lastLogin: new Date().toISOString()
        });
      }
      
      return { user, token };
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  async register(email: string, password: string, displayName: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, { displayName });
      
      const userData: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email!,
        displayName,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          language: 'pt-BR',
          notifications: {
            email: true,
            push: true,
            marketing: false
          }
        }
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      const token = await userCredential.user.getIdToken();
      
      return { user: userData, token };
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      const userCredential = await signInWithPopup(auth, provider);
      
      let user = await this.getUserData(userCredential.user.uid);
      
      if (!user) {
        const userData: User = {
          id: userCredential.user.uid,
          email: userCredential.user.email!,
          displayName: userCredential.user.displayName!,
          photoURL: userCredential.user.photoURL!,
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          preferences: {
            theme: 'dark',
            language: 'pt-BR',
            notifications: {
              email: true,
              push: true,
              marketing: false
            }
          }
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        user = userData;
      } else {
        await updateDoc(doc(db, 'users', user.id), {
          lastLogin: new Date().toISOString()
        });
      }
      
      const token = await userCredential.user.getIdToken();
      
      return { user, token };
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Erro ao fazer logout');
    }
  }

  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  async getUserData(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async updateUser(uid: string, data: Partial<User>) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error('Erro ao atualizar perfil');
    }
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/invalid-email': 'Email inválido',
      'auth/email-already-in-use': 'Email já está em uso',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
      'auth/network-request-failed': 'Erro de conexão',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/user-disabled': 'Conta desabilitada',
      'auth/requires-recent-login': 'Faça login novamente para continuar'
    };

    return errorMessages[errorCode] || 'Erro de autenticação';
  }
}

export const authService = new AuthService();