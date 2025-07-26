const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');

class AnalyticsProcessor {
  constructor(config = {}) {
    this.db = admin.firestore();
    this.pubsub = new PubSub();
    this.config = {
      batchSize: config.batchSize || 100,
      processingInterval: config.processingInterval || 60000, // 1 minuto
      retentionDays: config.retentionDays || 90
    };
    
    this.isProcessing = false;
    this.startProcessor();
  }

  /**
   * Iniciar processador de analytics
   */
  startProcessor() {
    console.log('📊 Iniciando processador de analytics');
    
    // Processar periodicamente
    setInterval(() => {
      if (!this.isProcessing) {
        this.processAnalytics();
      }
    }, this.config.processingInterval);

    // Configurar listeners do Pub/Sub
    this.setupPubSubListeners();
  }

  /**
   * Configurar listeners do Pub/Sub
   */
  setupPubSubListeners() {
    // Listener para eventos de conversa
    const conversationSubscription = this.pubsub.subscription('conversation-analytics');
    conversationSubscription.on('message', (message) => {
      this.processConversationEvent(JSON.parse(message.data.toString()));
      message.ack();
    });

    // Listener para eventos de fulfillment
    const fulfillmentSubscription = this.pubsub.subscription('fulfillment-analytics');
    fulfillmentSubscription.on('message', (message) => {
      this.processFulfillmentEvent(JSON.parse(message.data.toString()));
      message.ack();
    });

    console.log('✅ Pub/Sub listeners configurados');
  }

  /**
   * Processar evento de conversa
   */
  async processConversationEvent(eventData) {
    try {
      // Registrar evento individual
      await this.db.collection('conversation_analytics').add({
        ...eventData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processed: false
      });

      // Atualizar métricas em tempo real
      await this.updateRealTimeMetrics(eventData);

    } catch (error) {
      console.error('❌ Erro ao processar evento de conversa:', error);
    }
  }

  /**
   * Processar evento de fulfillment
   */
  async processFulfillmentEvent(eventData) {
    try {
      await this.db.collection('fulfillment_analytics').add({
        ...eventData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processed: false
      });

    } catch (error) {
      console.error('❌ Erro ao processar evento de fulfillment:', error);
    }
  }

  /**
   * Atualizar métricas em tempo real
   */
  async updateRealTimeMetrics(eventData) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      
      const metricsRef = this.db.collection('realtime_metrics').doc(today);
      
      await metricsRef.set({
        [`hours.${hour}.conversationsCount`]: admin.firestore.FieldValue.increment(1),
        [`hours.${hour}.avgConfidence`]: this.calculateRunningAverage(
          eventData.confidence || 0,
          `hours.${hour}.avgConfidence`,
          `hours.${hour}.conversationsCount`
        ),
        [`intents.${eventData.intentName}`]: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('❌ Erro ao atualizar métricas em tempo real:', error);
    }
  }

  /**
   * Processar analytics batch
   */
  async processAnalytics() {
    try {
      this.isProcessing = true;
      console.log('🔄 Processando batch de analytics');

      // Processar eventos não processados
      await this.processUnprocessedEvents();
      
      // Gerar relatórios diários
      await this.generateDailyReports();
      
      // Limpar dados antigos
      await this.cleanupOldData();
      
      this.isProcessing = false;
      console.log('✅ Batch de analytics processado');

    } catch (error) {
      console.error('❌ Erro no processamento de analytics:', error);
      this.isProcessing = false;
    }
  }

  /**
   * Processar eventos não processados
   */
  async processUnprocessedEvents() {
    try {
      const snapshot = await this.db
        .collection('conversation_analytics')
        .where('processed', '==', false)
        .limit(this.config.batchSize)
        .get();

      if (snapshot.empty) {
        return;
      }

      const batch = this.db.batch();
      const events = [];

      snapshot.docs.forEach(doc => {
        events.push({ id: doc.id, ...doc.data() });
        batch.update(doc.ref, { processed: true });
      });

      // Processar eventos
      await this.aggregateEvents(events);
      
      // Marcar como processados
      await batch.commit();
      
      console.log(`📊 ${events.length} eventos processados`);

    } catch (error) {
      console.error('❌ Erro ao processar eventos não processados:', error);
    }
  }

  /**
   * Agregar eventos para métricas
   */
  async aggregateEvents(events) {
    try {
      const aggregations = {
        byDate: {},
        byIntent: {},
        byHour: {},
        byConfidence: {},
        byUser: {}
      };

      events.forEach(event => {
        const date = event.timestamp?.toDate?.()?.toISOString()?.split('T')[0] || 
                    new Date().toISOString().split('T')[0];
        const hour = event.timestamp?.toDate?.()?.getHours() || new Date().getHours();
        const intent = event.intentName || 'unknown';
        const confidence = event.confidence || 0;
        const userId = event.userId || 'anonymous';

        // Agregação por data
        if (!aggregations.byDate[date]) {
          aggregations.byDate[date] = {
            totalEvents: 0,
            avgConfidence: 0,
            totalResponseTime: 0,
            uniqueUsers: new Set(),
            intents: {}
          };
        }
        
        aggregations.byDate[date].totalEvents++;
        aggregations.byDate[date].avgConfidence += confidence;
        aggregations.byDate[date].totalResponseTime += event.responseTime || 0;
        aggregations.byDate[date].uniqueUsers.add(userId);
        aggregations.byDate[date].intents[intent] = (aggregations.byDate[date].intents[intent] || 0) + 1;

        // Agregação por intent
        if (!aggregations.byIntent[intent]) {
          aggregations.byIntent[intent] = {
            totalRequests: 0,
            avgConfidence: 0,
            totalResponseTime: 0,
            lastSeen: null
          };
        }
        
        aggregations.byIntent[intent].totalRequests++;
        aggregations.byIntent[intent].avgConfidence += confidence;
        aggregations.byIntent[intent].totalResponseTime += event.responseTime || 0;
        aggregations.byIntent[intent].lastSeen = event.timestamp?.toDate() || new Date();

        // Agregação por hora
        const hourKey = `${date}_${hour}`;
        if (!aggregations.byHour[hourKey]) {
          aggregations.byHour[hourKey] = {
            totalEvents: 0,
            avgConfidence: 0
          };
        }
        
        aggregations.byHour[hourKey].totalEvents++;
        aggregations.byHour[hourKey].avgConfidence += confidence;
      });

      // Salvar agregações
      await this.saveAggregations(aggregations);

    } catch (error) {
      console.error('❌ Erro ao agregar eventos:', error);
    }
  }

  /**
   * Salvar agregações no Firestore
   */
  async saveAggregations(aggregations) {
    try {
      const batch = this.db.batch();

      // Salvar agregações por data
      Object.entries(aggregations.byDate).forEach(([date, data]) => {
        const docRef = this.db.collection('daily_analytics').doc(date);
        batch.set(docRef, {
          date,
          totalEvents: data.totalEvents,
          avgConfidence: data.totalEvents > 0 ? data.avgConfidence / data.totalEvents : 0,
          avgResponseTime: data.totalEvents > 0 ? data.totalResponseTime / data.totalEvents : 0,
          uniqueUsers: data.uniqueUsers.size,
          topIntents: this.getTopIntents(data.intents),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      // Salvar agregações por intent
      Object.entries(aggregations.byIntent).forEach(([intent, data]) => {
        const docRef = this.db.collection('intent_analytics').doc(intent);
        batch.set(docRef, {
          intentName: intent,
          totalRequests: admin.firestore.FieldValue.increment(data.totalRequests),
          avgConfidence: data.totalRequests > 0 ? data.avgConfidence / data.totalRequests : 0,
          avgResponseTime: data.totalRequests > 0 ? data.totalResponseTime / data.totalRequests : 0,
          lastSeen: data.lastSeen,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();

    } catch (error) {
      console.error('❌ Erro ao salvar agregações:', error);
    }
  }

  /**
   * Obter top intents de um conjunto
   */
  getTopIntents(intentsData) {
    return Object.entries(intentsData)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));
  }

  /**
   * Gerar relatórios diários
   */
  async generateDailyReports() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      console.log(`📈 Gerando relatório diário para: ${dateStr}`);

      // Buscar dados do dia
      const [dailyDoc, intentSnapshot, sessionSnapshot] = await Promise.all([
        this.db.collection('daily_analytics').doc(dateStr).get(),
        this.db.collection('intent_analytics').get(),
        this.db.collection('sessions')
          .where('startTime', '>=', new Date(dateStr))
          .where('startTime', '<', new Date(yesterday.getTime() + 24 * 60 * 60 * 1000))
          .get()
      ]);

      const dailyData = dailyDoc.exists ? dailyDoc.data() : {};
      const intentData = intentSnapshot.docs.map(doc => doc.data());
      const sessionData = sessionSnapshot.docs.map(doc => doc.data());

      // Calcular métricas do relatório
      const report = {
        date: dateStr,
        summary: {
          totalConversations: dailyData.totalEvents || 0,
          uniqueUsers: dailyData.uniqueUsers || 0,
          avgConfidence: dailyData.avgConfidence || 0,
          avgResponseTime: dailyData.avgResponseTime || 0,
          totalSessions: sessionData.length,
          avgSessionDuration: this.calculateAvgSessionDuration(sessionData),
          escalationRate: this.calculateEscalationRate(sessionData)
        },
        topIntents: dailyData.topIntents || [],
        intentPerformance: this.calculateIntentPerformance(intentData),
        hourlyDistribution: await this.getHourlyDistribution(dateStr),
        insights: this.generateInsights(dailyData, sessionData),
        recommendations: this.generateRecommendations(dailyData, sessionData)
      };

      // Salvar relatório
      await this.db.collection('daily_reports').doc(dateStr).set({
        ...report,
        generatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Relatório diário gerado: ${dateStr}`);

    } catch (error) {
      console.error('❌ Erro ao gerar relatório diário:', error);
    }
  }

  /**
   * Calcular duração média das sessões
   */
  calculateAvgSessionDuration(sessionData) {
    const completedSessions = sessionData.filter(s => s.endTime && s.startTime);
    
    if (completedSessions.length === 0) {
      return 0;
    }

    const totalDuration = completedSessions.reduce((sum, session) => {
      const duration = session.endTime.toDate().getTime() - session.startTime.toDate().getTime();
      return sum + duration;
    }, 0);

    return Math.round(totalDuration / completedSessions.length / 1000); // em segundos
  }

  /**
   * Calcular taxa de escalação
   */
  calculateEscalationRate(sessionData) {
    const totalSessions = sessionData.length;
    const escalatedSessions = sessionData.filter(s => s.status === 'escalated').length;
    
    return totalSessions > 0 ? escalatedSessions / totalSessions : 0;
  }

  /**
   * Calcular performance dos intents
   */
  calculateIntentPerformance(intentData) {
    return intentData
      .sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0))
      .slice(0, 20)
      .map(intent => ({
        intentName: intent.intentName,
        totalRequests: intent.totalRequests || 0,
        avgConfidence: Math.round((intent.avgConfidence || 0) * 100) / 100,
        avgResponseTime: Math.round(intent.avgResponseTime || 0),
        trend: 'stable' // Seria calculado comparando com período anterior
      }));
  }

  /**
   * Obter distribuição por hora
   */
  async getHourlyDistribution(date) {
    try {
      const hourlyData = [];
      
      for (let hour = 0; hour < 24; hour++) {
        const hourKey = `${date}_${hour}`;
        const doc = await this.db.collection('hourly_analytics').doc(hourKey).get();
        
        hourlyData.push({
          hour,
          events: doc.exists ? doc.data().totalEvents || 0 : 0,
          avgConfidence: doc.exists ? doc.data().avgConfidence || 0 : 0
        });
      }

      return hourlyData;

    } catch (error) {
      console.error('❌ Erro ao obter distribuição por hora:', error);
      return [];
    }
  }

  /**
   * Gerar insights
   */
  generateInsights(dailyData, sessionData) {
    const insights = [];

    // Insight sobre confiança média
    if (dailyData.avgConfidence < 0.7) {
      insights.push({
        type: 'confidence',
        level: 'warning',
        message: `Confiança média baixa (${Math.round(dailyData.avgConfidence * 100)}%). Considere revisar training phrases.`
      });
    }

    // Insight sobre tempo de resposta
    if (dailyData.avgResponseTime > 2000) {
      insights.push({
        type: 'performance',
        level: 'warning',
        message: `Tempo médio de resposta alto (${Math.round(dailyData.avgResponseTime)}ms). Otimização necessária.`
      });
    }

    // Insight sobre escalação
    const escalationRate = this.calculateEscalationRate(sessionData);
    if (escalationRate > 0.15) {
      insights.push({
        type: 'escalation',
        level: 'warning',
        message: `Taxa de escalação alta (${Math.round(escalationRate * 100)}%). Revisar automação.`
      });
    }

    return insights;
  }

  /**
   * Gerar recomendações
   */
  generateRecommendations(dailyData, sessionData) {
    const recommendations = [];

    if (dailyData.avgConfidence < 0.8) {
      recommendations.push({
        priority: 'high',
        category: 'training',
        action: 'Adicionar mais training phrases aos intents com baixa confiança',
        impact: 'Melhoria na precisão do reconhecimento'
      });
    }

    if (dailyData.avgResponseTime > 1500) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        action: 'Otimizar webhooks e fulfillment functions',
        impact: 'Redução no tempo de resposta'
      });
    }

    const lowVolumeIntents = (dailyData.topIntents || []).filter(i => i.count < 5);
    if (lowVolumeIntents.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        action: 'Revisar intents com baixo volume de uso',
        impact: 'Simplificação do modelo'
      });
    }

    return recommendations;
  }

  /**
   * Limpar dados antigos
   */
  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      console.log(`🗑️ Limpando dados anteriores a: ${cutoffDate.toISOString()}`);

      // Limpar analytics de conversa
      const analyticsSnapshot = await this.db
        .collection('conversation_analytics')
        .where('timestamp', '<', cutoffDate)
        .limit(1000)
        .get();

      if (!analyticsSnapshot.empty) {
        const batch = this.db.batch();
        analyticsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`🗑️ ${analyticsSnapshot.size} registros de analytics removidos`);
      }

      // Limpar métricas em tempo real antigas
      const metricsSnapshot = await this.db
        .collection('realtime_metrics')
        .where('lastUpdated', '<', cutoffDate)
        .get();

      if (!metricsSnapshot.empty) {
        const batch = this.db.batch();
        metricsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`🗑️ ${metricsSnapshot.size} métricas em tempo real removidas`);
      }

    } catch (error) {
      console.error('❌ Erro na limpeza de dados antigos:', error);
    }
  }

  /**
   * Calcular média corrente (para métricas em tempo real)
   */
  calculateRunningAverage(newValue, avgField, countField) {
    return admin.firestore.FieldValue.serverTimestamp(); // Placeholder - implementação real seria mais complexa
  }

  /**
   * Obter métricas de performance
   */
  async getPerformanceMetrics(startDate, endDate) {
    try {
      const snapshot = await this.db
        .collection('conversation_analytics')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const events = snapshot.docs.map(doc => doc.data());
      
      if (events.length === 0) {
        return {
          totalEvents: 0,
          avgConfidence: 0,
          avgResponseTime: 0,
          successRate: 0,
          topIntents: []
        };
      }

      const avgConfidence = events.reduce((sum, e) => sum + (e.confidence || 0), 0) / events.length;
      const avgResponseTime = events.reduce((sum, e) => sum + (e.responseTime || 0), 0) / events.length;
      const successfulEvents = events.filter(e => e.fulfilled).length;
      const successRate = successfulEvents / events.length;

      // Top intents
      const intentCounts = {};
      events.forEach(event => {
        const intent = event.intentName || 'unknown';
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      });

      const topIntents = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEvents: events.length,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        successRate: Math.round(successRate * 100) / 100,
        topIntents
      };

    } catch (error) {
      console.error('❌ Erro ao obter métricas de performance:', error);
      throw new Error('Falha ao obter métricas de performance');
    }
  }

  /**
   * Obter dados para dashboard
   */
  async getDashboardData(period = '24h') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const [performanceMetrics, realtimeDoc] = await Promise.all([
        this.getPerformanceMetrics(startDate, endDate),
        this.db.collection('realtime_metrics').doc(new Date().toISOString().split('T')[0]).get()
      ]);

      const realtimeData = realtimeDoc.exists ? realtimeDoc.data() : {};

      return {
        ...performanceMetrics,
        realtime: {
          currentHourEvents: realtimeData.hours?.[new Date().getHours()]?.conversationsCount || 0,
          trend: 'stable' // Calculado comparando com hora anterior
        }
      };

    } catch (error) {
      console.error('❌ Erro ao obter dados do dashboard:', error);
      throw new Error('Falha ao obter dados do dashboard');
    }
  }
}

module.exports = AnalyticsProcessor;