import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  where, 
  orderBy, 
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from '../types/user';

export class UserService {
  async getUsers(params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<User[]> {
    try {
      let q = query(collection(db, 'users'));

      if (params?.role && params.role !== 'all') {
        q = query(q, where('role', '==', params.role));
      }

      if (params?.status && params.status !== 'all') {
        q = query(q, where('status', '==', params.status));
      }

      q = query(q, orderBy('createdAt', 'desc'));

      if (params?.limit) {
        q = query(q, limit(params.limit));
      }

      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];

      // Filter by search term if provided
      if (params?.search) {
        const searchTerm = params.search.toLowerCase();
        return users.filter(user => 
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm)
        );
      }

      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw new Error('Erro ao buscar usuários');
    }
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Erro ao atualizar usuário');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      // Soft delete - just mark as deleted
      await updateDoc(doc(db, 'users', userId), {
        status: 'deleted',
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Erro ao excluir usuário');
    }
  }

  async getUserStats(userId: string) {
    try {
      // Get user-related statistics
      const stats = {
        totalConversations: 0,
        totalMessages: 0,
        averageRating: 0,
        lastActivity: null
      };

      // TODO: Implement actual stats collection from conversations/messages
      
      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  async bulkUpdateUsers(userIds: string[], data: Partial<User>): Promise<void> {
    try {
      const batch = []; // Firebase batch operations
      
      for (const userId of userIds) {
        batch.push(
          updateDoc(doc(db, 'users', userId), {
            ...data,
            updatedAt: new Date().toISOString()
          })
        );
      }

      await Promise.all(batch);
    } catch (error) {
      console.error('Error bulk updating users:', error);
      throw new Error('Erro ao atualizar usuários em lote');
    }
  }

  async getUserActivity(userId: string, days: number = 30) {
    try {
      // Get user activity for the last N days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // TODO: Implement actual activity tracking
      
      return {
        dailyActivity: [],
        totalSessions: 0,
        averageSessionDuration: 0,
        topFeatures: []
      };
    } catch (error) {
      console.error('Error getting user activity:', error);
      return null;
    }
  }
}

export const userService = new UserService();