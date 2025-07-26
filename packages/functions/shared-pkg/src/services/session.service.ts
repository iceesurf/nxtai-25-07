import { SessionsClient } from '@google-cloud/dialogflow-cx';
import * as admin from 'firebase-admin';

export interface SessionInfo {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  lastActivity: Date;
  messageCount: number;
  status: 'active' | 'expired' | 'ended';
  context: { [key: string]: any };
  metadata?: { [key: string]: any };
}

export interface SessionConfig {
  projectId: string;
  location: string;
  agentId: string;
  sessionTtl?: number; // em minutos, padrão 30
}

export interface ConversationTurn {
  timestamp: Date;
  userInput: string;
  botResponse: string;
  intent: string;
  confidence: number;
  parameters?: { [key: string]: any };
}

export class SessionService {
  private client: SessionsClient;
  private config: SessionConfig;
  private db: admin.firestore.Firestore;
  private sessionTtl: number;

  constructor(config: SessionConfig) {
    this.client = new SessionsClient();
    this.config = config;
    this.db = admin.firestore();
    this.sessionTtl = config.sessionTtl || 30; // 30 minutos padrão
  }

  private getSessionPath(sessionId: string): string {
    return this.client.projectLocationAgentSessionPath(
      this.config.projectId,
      this.config.location,
      this.config.agentId,
      sessionId
    );
  }

  async createSession(userId?: string, metadata?: { [key: string]: any }): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();
      
      const sessionInfo: SessionInfo = {
        sessionId,
        userId,
        startTime: now,
        lastActivity: now,
        messageCount: 0,
        status: 'active',
        context: {},
        metadata: metadata || {}
      };

      await this.db.collection('sessions').doc(sessionId).set({
        ...sessionInfo,
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Session created: ${sessionId}`);
      return sessionId;

    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw new Error('Failed to create session');
    }
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      const doc = await this.db.collection('sessions').doc(sessionId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        sessionId: data.sessionId,
        userId: data.userId,
        startTime: data.startTime?.toDate() || new Date(),
        endTime: data.endTime?.toDate(),
        lastActivity: data.lastActivity?.toDate() || new Date(),
        messageCount: data.messageCount || 0,
        status: data.status || 'active',
        context: data.context || {},
        metadata: data.metadata || {}
      };

    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionInfo>): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.endTime) {
        updateData.endTime = admin.firestore.FieldValue.serverTimestamp();
      }

      await this.db.collection('sessions').doc(sessionId).update(updateData);
      console.log(`✅ Session updated: ${sessionId}`);

    } catch (error) {
      console.error('❌ Error updating session:', error);
      throw new Error(`Failed to update session: ${sessionId}`);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, {
        status: 'ended',
        endTime: new Date()
      });

      console.log(`✅ Session ended: ${sessionId}`);

    } catch (error) {
      console.error('❌ Error ending session:', error);
      throw new Error(`Failed to end session: ${sessionId}`);
    }
  }

  async addConversationTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
    try {
      // Adicionar turn à subcoleção de conversas
      await this.db
        .collection('sessions')
        .doc(sessionId)
        .collection('conversation')
        .add({
          ...turn,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      // Incrementar contador de mensagens
      await this.db.collection('sessions').doc(sessionId).update({
        messageCount: admin.firestore.FieldValue.increment(1),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Error adding conversation turn:', error);
      throw new Error(`Failed to add conversation turn to session: ${sessionId}`);
    }
  }

  async getConversationHistory(sessionId: string, limit: number = 50): Promise<ConversationTurn[]> {
    try {
      const snapshot = await this.db
        .collection('sessions')
        .doc(sessionId)
        .collection('conversation')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          timestamp: data.timestamp?.toDate() || new Date(),
          userInput: data.userInput,
          botResponse: data.botResponse,
          intent: data.intent,
          confidence: data.confidence,
          parameters: data.parameters
        };
      }).reverse(); // Retornar em ordem cronológica

    } catch (error) {
      console.error('❌ Error getting conversation history:', error);
      return [];
    }
  }

  async setSessionContext(sessionId: string, context: { [key: string]: any }): Promise<void> {
    try {
      await this.updateSession(sessionId, { context });
    } catch (error) {
      console.error('❌ Error setting session context:', error);
      throw new Error(`Failed to set context for session: ${sessionId}`);
    }
  }

  async getSessionContext(sessionId: string): Promise<{ [key: string]: any }> {
    try {
      const session = await this.getSession(sessionId);
      return session?.context || {};
    } catch (error) {
      console.error('❌ Error getting session context:', error);
      return {};
    }
  }

  async listActiveSessions(userId?: string): Promise<SessionInfo[]> {
    try {
      let query = this.db
        .collection('sessions')
        .where('status', '==', 'active');

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sessionId: data.sessionId,
          userId: data.userId,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          lastActivity: data.lastActivity?.toDate() || new Date(),
          messageCount: data.messageCount || 0,
          status: data.status || 'active',
          context: data.context || {},
          metadata: data.metadata || {}
        };
      });

    } catch (error) {
      console.error('❌ Error listing active sessions:', error);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const expiredTime = new Date();
      expiredTime.setMinutes(expiredTime.getMinutes() - this.sessionTtl);

      const snapshot = await this.db
        .collection('sessions')
        .where('status', '==', 'active')
        .where('lastActivity', '<', expiredTime)
        .get();

      const batch = this.db.batch();
      let expiredCount = 0;

      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'expired',
          endTime: admin.firestore.FieldValue.serverTimestamp()
        });
        expiredCount++;
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`✅ Expired ${expiredCount} sessions`);
      }

      return expiredCount;

    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'active') {
        return false;
      }

      const now = new Date();
      const lastActivity = session.lastActivity;
      const timeDiff = (now.getTime() - lastActivity.getTime()) / (1000 * 60); // em minutos

      return timeDiff <= this.sessionTtl;

    } catch (error) {
      console.error('❌ Error checking session status:', error);
      return false;
    }
  }

  async getSessionStats(sessionId: string): Promise<{
    duration: number;
    messageCount: number;
    avgResponseTime?: number;
    topIntents: Array<{intent: string, count: number}>;
  }> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const conversationHistory = await this.getConversationHistory(sessionId);
      
      const duration = session.endTime 
        ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
        : (new Date().getTime() - session.startTime.getTime()) / 1000;

      // Contar intents
      const intentCounts: { [key: string]: number } = {};
      conversationHistory.forEach(turn => {
        intentCounts[turn.intent] = (intentCounts[turn.intent] || 0) + 1;
      });

      const topIntents = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        duration: Math.round(duration),
        messageCount: session.messageCount,
        topIntents
      };

    } catch (error) {
      console.error('❌ Error getting session stats:', error);
      throw new Error(`Failed to get stats for session: ${sessionId}`);
    }
  }

  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  async transferSession(sessionId: string, targetAgent: string, context?: { [key: string]: any }): Promise<void> {
    try {
      const updates: any = {
        status: 'transferred',
        transferredTo: targetAgent,
        transferredAt: new Date()
      };

      if (context) {
        updates.context = context;
      }

      await this.updateSession(sessionId, updates);
      console.log(`✅ Session transferred: ${sessionId} -> ${targetAgent}`);

    } catch (error) {
      console.error('❌ Error transferring session:', error);
      throw new Error(`Failed to transfer session: ${sessionId}`);
    }
  }
}