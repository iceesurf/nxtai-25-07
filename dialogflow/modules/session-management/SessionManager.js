const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const admin = require('firebase-admin');

class SessionManager {
  constructor(config) {
    this.projectId = config.projectId;
    this.location = config.location;
    this.agentId = config.agentId;
    this.sessionsClient = new SessionsClient();
    this.db = admin.firestore();
    this.sessionTtl = config.sessionTtl || 30; // 30 minutos padrão
    this.activeSessions = new Map();
  }

  /**
   * Criar nova sessão
   */
  async createSession(userId = null, metadata = {}) {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();
      
      console.log(`🔄 Criando sessão: ${sessionId}`);
      
      const sessionInfo = {
        sessionId,
        userId,
        startTime: now,
        lastActivity: now,
        messageCount: 0,
        status: 'active',
        context: {},
        metadata: {
          ...metadata,
          userAgent: metadata.userAgent || 'unknown',
          platform: metadata.platform || 'web',
          language: metadata.language || 'pt-br',
          location: metadata.location || null
        },
        analytics: {
          totalMessages: 0,
          intentsTriggered: [],
          avgResponseTime: 0,
          satisfactionScore: null,
          escalated: false
        }
      };

      // Salvar no Firestore
      await this.db.collection('sessions').doc(sessionId).set({
        ...sessionInfo,
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

      // Adicionar ao cache local
      this.activeSessions.set(sessionId, sessionInfo);
      
      console.log(`✅ Sessão criada: ${sessionId}`);
      return sessionId;

    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error);
      throw new Error('Falha ao criar sessão');
    }
  }

  /**
   * Obter informações da sessão
   */
  async getSession(sessionId) {
    try {
      // Verificar cache primeiro
      if (this.activeSessions.has(sessionId)) {
        const cached = this.activeSessions.get(sessionId);
        // Verificar se não expirou (cache por 5 minutos)
        if (Date.now() - cached.lastActivity.getTime() < 300000) {
          return cached;
        }
      }

      // Buscar no Firestore
      const doc = await this.db.collection('sessions').doc(sessionId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      const sessionInfo = {
        sessionId: data.sessionId,
        userId: data.userId,
        startTime: data.startTime?.toDate() || new Date(),
        endTime: data.endTime?.toDate(),
        lastActivity: data.lastActivity?.toDate() || new Date(),
        messageCount: data.messageCount || 0,
        status: data.status || 'active',
        context: data.context || {},
        metadata: data.metadata || {},
        analytics: data.analytics || {}
      };

      // Verificar se sessão expirou
      if (this.isSessionExpired(sessionInfo)) {
        await this.expireSession(sessionId);
        sessionInfo.status = 'expired';
      }

      // Atualizar cache
      this.activeSessions.set(sessionId, sessionInfo);
      
      return sessionInfo;

    } catch (error) {
      console.error('❌ Erro ao obter sessão:', error);
      return null;
    }
  }

  /**
   * Atualizar sessão
   */
  async updateSession(sessionId, updates) {
    try {
      const updateData = {
        ...updates,
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.endTime) {
        updateData.endTime = admin.firestore.FieldValue.serverTimestamp();
      }

      await this.db.collection('sessions').doc(sessionId).update(updateData);
      
      // Atualizar cache
      if (this.activeSessions.has(sessionId)) {
        const cached = this.activeSessions.get(sessionId);
        Object.assign(cached, updates);
        cached.lastActivity = new Date();
      }
      
      console.log(`✅ Sessão atualizada: ${sessionId}`);

    } catch (error) {
      console.error('❌ Erro ao atualizar sessão:', error);
      throw new Error(`Falha ao atualizar sessão: ${sessionId}`);
    }
  }

  /**
   * Finalizar sessão
   */
  async endSession(sessionId, reason = 'user_ended') {
    try {
      console.log(`🔚 Finalizando sessão: ${sessionId}`);
      
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Sessão não encontrada: ${sessionId}`);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - session.startTime.getTime();

      await this.updateSession(sessionId, {
        status: 'ended',
        endTime,
        endReason: reason,
        duration: Math.round(duration / 1000) // em segundos
      });

      // Remover do cache
      this.activeSessions.delete(sessionId);
      
      // Registrar analytics finais
      await this.recordSessionAnalytics(sessionId, session);
      
      console.log(`✅ Sessão finalizada: ${sessionId}`);

    } catch (error) {
      console.error('❌ Erro ao finalizar sessão:', error);
      throw new Error(`Falha ao finalizar sessão: ${sessionId}`);
    }
  }

  /**
   * Adicionar turno de conversa
   */
  async addConversationTurn(sessionId, turnData) {
    try {
      const {
        userInput,
        botResponse,
        intent,
        confidence,
        parameters,
        responseTime,
        fulfillmentUsed
      } = turnData;

      // Adicionar à subcoleção de conversas
      const turnDoc = await this.db
        .collection('sessions')
        .doc(sessionId)
        .collection('conversation')
        .add({
          userInput,
          botResponse,
          intent,
          confidence,
          parameters: parameters || {},
          responseTime,
          fulfillmentUsed: fulfillmentUsed || false,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      // Atualizar contador de mensagens e analytics
      const session = await this.getSession(sessionId);
      if (session) {
        const updatedAnalytics = {
          ...session.analytics,
          totalMessages: (session.analytics.totalMessages || 0) + 1,
          intentsTriggered: [...(session.analytics.intentsTriggered || []), intent],
          avgResponseTime: this.calculateAvgResponseTime(
            session.analytics.avgResponseTime || 0,
            session.analytics.totalMessages || 0,
            responseTime
          )
        };

        await this.updateSession(sessionId, {
          messageCount: admin.firestore.FieldValue.increment(1),
          analytics: updatedAnalytics
        });
      }

      return turnDoc.id;

    } catch (error) {
      console.error('❌ Erro ao adicionar turno de conversa:', error);
      throw new Error(`Falha ao adicionar turno de conversa na sessão: ${sessionId}`);
    }
  }

  /**
   * Obter histórico de conversa
   */
  async getConversationHistory(sessionId, limit = 50) {
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
          id: doc.id,
          userInput: data.userInput,
          botResponse: data.botResponse,
          intent: data.intent,
          confidence: data.confidence,
          parameters: data.parameters,
          responseTime: data.responseTime,
          fulfillmentUsed: data.fulfillmentUsed,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      }).reverse(); // Retornar em ordem cronológica

    } catch (error) {
      console.error('❌ Erro ao obter histórico de conversa:', error);
      return [];
    }
  }

  /**
   * Definir contexto da sessão
   */
  async setSessionContext(sessionId, contextKey, contextValue, lifespan = null) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Sessão não encontrada: ${sessionId}`);
      }

      const updatedContext = {
        ...session.context,
        [contextKey]: {
          value: contextValue,
          lifespan,
          createdAt: new Date(),
          expiresAt: lifespan ? new Date(Date.now() + lifespan * 60000) : null
        }
      };

      await this.updateSession(sessionId, { context: updatedContext });

    } catch (error) {
      console.error('❌ Erro ao definir contexto da sessão:', error);
      throw new Error(`Falha ao definir contexto para sessão: ${sessionId}`);
    }
  }

  /**
   * Obter contexto da sessão
   */
  async getSessionContext(sessionId, contextKey = null) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return null;
      }

      // Limpar contextos expirados
      const cleanedContext = this.cleanExpiredContext(session.context);
      
      if (contextKey) {
        return cleanedContext[contextKey]?.value || null;
      }

      // Retornar apenas os valores, não a metadata
      const contextValues = {};
      Object.entries(cleanedContext).forEach(([key, contextData]) => {
        contextValues[key] = contextData.value;
      });

      return contextValues;

    } catch (error) {
      console.error('❌ Erro ao obter contexto da sessão:', error);
      return null;
    }
  }

  /**
   * Limpar contextos expirados
   */
  cleanExpiredContext(context) {
    const now = new Date();
    const cleanedContext = {};

    Object.entries(context).forEach(([key, contextData]) => {
      if (!contextData.expiresAt || contextData.expiresAt > now) {
        cleanedContext[key] = contextData;
      }
    });

    return cleanedContext;
  }

  /**
   * Listar sessões ativas
   */
  async listActiveSessions(userId = null, limit = 50) {
    try {
      let query = this.db
        .collection('sessions')
        .where('status', '==', 'active')
        .orderBy('lastActivity', 'desc')
        .limit(limit);

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sessionId: data.sessionId,
          userId: data.userId,
          startTime: data.startTime?.toDate(),
          lastActivity: data.lastActivity?.toDate(),
          messageCount: data.messageCount,
          metadata: data.metadata,
          analytics: data.analytics
        };
      });

    } catch (error) {
      console.error('❌ Erro ao listar sessões ativas:', error);
      return [];
    }
  }

  /**
   * Limpar sessões expiradas
   */
  async cleanupExpiredSessions() {
    try {
      const expiredTime = new Date();
      expiredTime.setMinutes(expiredTime.getMinutes() - this.sessionTtl);

      console.log(`🧹 Limpando sessões inativas desde: ${expiredTime.toISOString()}`);

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
          endTime: admin.firestore.FieldValue.serverTimestamp(),
          endReason: 'timeout'
        });
        
        // Remover do cache
        this.activeSessions.delete(doc.data().sessionId);
        expiredCount++;
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`✅ ${expiredCount} sessões expiradas`);
      }

      return expiredCount;

    } catch (error) {
      console.error('❌ Erro ao limpar sessões expiradas:', error);
      return 0;
    }
  }

  /**
   * Verificar se sessão está ativa
   */
  async isSessionActive(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'active') {
        return false;
      }

      return !this.isSessionExpired(session);

    } catch (error) {
      console.error('❌ Erro ao verificar status da sessão:', error);
      return false;
    }
  }

  /**
   * Verificar se sessão expirou
   */
  isSessionExpired(session) {
    const now = new Date();
    const lastActivity = session.lastActivity;
    const timeDiff = (now.getTime() - lastActivity.getTime()) / (1000 * 60); // em minutos

    return timeDiff > this.sessionTtl;
  }

  /**
   * Expirar sessão
   */
  async expireSession(sessionId) {
    try {
      await this.updateSession(sessionId, {
        status: 'expired',
        endTime: new Date(),
        endReason: 'timeout'
      });

      this.activeSessions.delete(sessionId);

    } catch (error) {
      console.error('❌ Erro ao expirar sessão:', error);
    }
  }

  /**
   * Obter estatísticas da sessão
   */
  async getSessionStatistics(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Sessão não encontrada: ${sessionId}`);
      }

      const conversationHistory = await this.getConversationHistory(sessionId);
      
      const duration = session.endTime 
        ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
        : (new Date().getTime() - session.startTime.getTime()) / 1000;

      // Contar intents únicos
      const uniqueIntents = [...new Set(conversationHistory.map(turn => turn.intent))];
      
      // Calcular confiança média
      const avgConfidence = conversationHistory.length > 0
        ? conversationHistory.reduce((sum, turn) => sum + turn.confidence, 0) / conversationHistory.length
        : 0;

      // Tempo médio de resposta
      const avgResponseTime = conversationHistory.length > 0
        ? conversationHistory.reduce((sum, turn) => sum + turn.responseTime, 0) / conversationHistory.length
        : 0;

      return {
        sessionId,
        duration: Math.round(duration),
        messageCount: session.messageCount,
        uniqueIntentsCount: uniqueIntents.length,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        status: session.status,
        escalated: session.analytics?.escalated || false
      };

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas da sessão:', error);
      throw new Error(`Falha ao obter estatísticas da sessão: ${sessionId}`);
    }
  }

  /**
   * Transferir sessão para agente humano
   */
  async transferToHuman(sessionId, reason = 'user_request', agentId = null) {
    try {
      console.log(`👨‍💼 Transferindo sessão para humano: ${sessionId}`);
      
      const updates = {
        status: 'transferred',
        transferredAt: new Date(),
        transferReason: reason,
        transferredTo: agentId || 'available_agent',
        'analytics.escalated': true
      };

      await this.updateSession(sessionId, updates);
      
      // Adicionar evento de transferência
      await this.addConversationTurn(sessionId, {
        userInput: '[SYSTEM]',
        botResponse: 'Transferindo para atendimento humano...',
        intent: 'system.transfer',
        confidence: 1.0,
        responseTime: 0,
        fulfillmentUsed: true
      });

      console.log(`✅ Sessão transferida: ${sessionId}`);

    } catch (error) {
      console.error('❌ Erro ao transferir sessão:', error);
      throw new Error(`Falha ao transferir sessão: ${sessionId}`);
    }
  }

  /**
   * Gerar ID único para sessão
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Calcular tempo médio de resposta
   */
  calculateAvgResponseTime(currentAvg, currentCount, newResponseTime) {
    if (currentCount === 0) {
      return newResponseTime;
    }
    
    return Math.round(((currentAvg * currentCount) + newResponseTime) / (currentCount + 1));
  }

  /**
   * Registrar analytics da sessão
   */
  async recordSessionAnalytics(sessionId, session) {
    try {
      const analyticsData = {
        sessionId,
        userId: session.userId,
        startTime: session.startTime,
        endTime: session.endTime || new Date(),
        duration: session.duration || 0,
        messageCount: session.messageCount,
        platform: session.metadata?.platform || 'unknown',
        language: session.metadata?.language || 'pt-br',
        endReason: session.endReason || 'unknown',
        escalated: session.analytics?.escalated || false,
        avgConfidence: session.analytics?.avgConfidence || 0,
        avgResponseTime: session.analytics?.avgResponseTime || 0,
        uniqueIntents: session.analytics?.intentsTriggered?.length || 0,
        satisfactionScore: session.analytics?.satisfactionScore,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('session_analytics').add(analyticsData);

    } catch (error) {
      console.error('❌ Erro ao registrar analytics da sessão:', error);
    }
  }

  /**
   * Obter métricas gerais de sessões
   */
  async getSessionMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db
        .collection('sessions')
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

      const sessions = snapshot.docs.map(doc => doc.data());
      
      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          avgDuration: 0,
          avgMessagesPerSession: 0,
          completionRate: 0,
          escalationRate: 0
        };
      }

      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'ended').length;
      const escalatedSessions = sessions.filter(s => s.analytics?.escalated).length;
      
      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

      return {
        totalSessions,
        avgDuration: Math.round(totalDuration / totalSessions),
        avgMessagesPerSession: Math.round(totalMessages / totalSessions * 10) / 10,
        completionRate: Math.round((completedSessions / totalSessions) * 100) / 100,
        escalationRate: Math.round((escalatedSessions / totalSessions) * 100) / 100
      };

    } catch (error) {
      console.error('❌ Erro ao obter métricas de sessões:', error);
      throw new Error('Falha ao obter métricas de sessões');
    }
  }
}

module.exports = SessionManager;