import * as admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';

export interface ConversationAnalytics {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  intentName: string;
  confidence: number;
  fulfilled: boolean;
  responseTime: number;
  userSatisfaction?: number;
  language: string;
  platform: string;
  escalated: boolean;
  parameters?: { [key: string]: any };
}

export interface IntentMetrics {
  intentName: string;
  totalRequests: number;
  avgConfidence: number;
  fulfillmentRate: number;
  escalationRate: number;
  avgResponseTime: number;
  topParameters: Array<{ parameter: string; count: number }>;
  trend: 'up' | 'down' | 'stable';
}

export interface SessionMetrics {
  totalSessions: number;
  avgSessionDuration: number;
  avgMessagesPerSession: number;
  completionRate: number;
  escalationRate: number;
  userSatisfactionAvg: number;
  topExitPoints: Array<{ intent: string; count: number }>;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number; // mensagens por minuto
  peakHours: Array<{ hour: number; count: number }>;
  dailyVolume: Array<{ date: string; count: number }>;
}

export interface UserBehaviorMetrics {
  newUsers: number;
  returningUsers: number;
  avgSessionsPerUser: number;
  userRetentionRate: number;
  topUserActions: Array<{ action: string; count: number }>;
  geographicDistribution: Array<{ region: string; count: number }>;
}

export interface AnalyticsReport {
  id?: string;
  name: string;
  period: { startDate: Date; endDate: Date };
  intentMetrics: IntentMetrics[];
  sessionMetrics: SessionMetrics;
  performanceMetrics: PerformanceMetrics;
  userBehaviorMetrics: UserBehaviorMetrics;
  insights: string[];
  recommendations: string[];
  createdAt?: Date;
}

export class AnalyticsService {
  private db: admin.firestore.Firestore;
  private pubsub: PubSub;

  constructor() {
    this.db = admin.firestore();
    this.pubsub = new PubSub();
  }

  async recordConversationEvent(analytics: ConversationAnalytics): Promise<void> {
    try {
      await this.db.collection('conversation_analytics').add({
        ...analytics,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Publicar no Pub/Sub para processamento em tempo real
      await this.pubsub.topic('conversation-analytics').publish(
        Buffer.from(JSON.stringify(analytics))
      );

    } catch (error) {
      console.error('❌ Error recording conversation event:', error);
    }
  }

  async getIntentMetrics(startDate: Date, endDate: Date): Promise<IntentMetrics[]> {
    try {
      const snapshot = await this.db
        .collection('conversation_analytics')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const intentData: { [key: string]: ConversationAnalytics[] } = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data() as ConversationAnalytics;
        if (!intentData[data.intentName]) {
          intentData[data.intentName] = [];
        }
        intentData[data.intentName].push(data);
      });

      const intentMetrics: IntentMetrics[] = [];

      Object.entries(intentData).forEach(([intentName, events]) => {
        const totalRequests = events.length;
        const avgConfidence = events.reduce((sum, e) => sum + e.confidence, 0) / totalRequests;
        const fulfillmentRate = events.filter(e => e.fulfilled).length / totalRequests;
        const escalationRate = events.filter(e => e.escalated).length / totalRequests;
        const avgResponseTime = events.reduce((sum, e) => sum + e.responseTime, 0) / totalRequests;
        
        // Calcular parâmetros mais usados
        const parameterCounts: { [key: string]: number } = {};
        events.forEach(event => {
          if (event.parameters) {
            Object.keys(event.parameters).forEach(param => {
              parameterCounts[param] = (parameterCounts[param] || 0) + 1;
            });
          }
        });

        const topParameters = Object.entries(parameterCounts)
          .map(([parameter, count]) => ({ parameter, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        intentMetrics.push({
          intentName,
          totalRequests,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
          escalationRate: Math.round(escalationRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime),
          topParameters,
          trend: this.calculateTrend(intentName, startDate, endDate)
        });
      });

      return intentMetrics.sort((a, b) => b.totalRequests - a.totalRequests);

    } catch (error) {
      console.error('❌ Error getting intent metrics:', error);
      return [];
    }
  }

  async getSessionMetrics(startDate: Date, endDate: Date): Promise<SessionMetrics> {
    try {
      // Buscar sessões no período
      const sessionSnapshot = await this.db
        .collection('sessions')
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

      const sessions = sessionSnapshot.docs.map(doc => doc.data());
      
      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          avgSessionDuration: 0,
          avgMessagesPerSession: 0,
          completionRate: 0,
          escalationRate: 0,
          userSatisfactionAvg: 0,
          topExitPoints: []
        };
      }

      // Calcular métricas
      const totalSessions = sessions.length;
      
      const durations = sessions
        .filter(s => s.endTime && s.startTime)
        .map(s => (s.endTime.toDate().getTime() - s.startTime.toDate().getTime()) / 1000);
      
      const avgSessionDuration = durations.length > 0 
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
        : 0;

      const avgMessagesPerSession = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0) / totalSessions;
      
      const completedSessions = sessions.filter(s => s.status === 'ended').length;
      const completionRate = completedSessions / totalSessions;
      
      const escalatedSessions = sessions.filter(s => s.status === 'escalated').length;
      const escalationRate = escalatedSessions / totalSessions;

      // Buscar satisfação do usuário (implementação simplificada)
      const userSatisfactionAvg = 4.2; // Valor fixo por enquanto

      // Top exit points (implementação simplificada)
      const topExitPoints = [
        { intent: 'transfer-to-human', count: escalatedSessions },
        { intent: 'goodbye', count: completedSessions },
        { intent: 'default-fallback', count: Math.floor(totalSessions * 0.1) }
      ].sort((a, b) => b.count - a.count);

      return {
        totalSessions,
        avgSessionDuration: Math.round(avgSessionDuration),
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        completionRate: Math.round(completionRate * 100) / 100,
        escalationRate: Math.round(escalationRate * 100) / 100,
        userSatisfactionAvg: Math.round(userSatisfactionAvg * 10) / 10,
        topExitPoints: topExitPoints.slice(0, 5)
      };

    } catch (error) {
      console.error('❌ Error getting session metrics:', error);
      throw new Error('Failed to get session metrics');
    }
  }

  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics> {
    try {
      const snapshot = await this.db
        .collection('conversation_analytics')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const events = snapshot.docs.map(doc => doc.data() as ConversationAnalytics);
      
      if (events.length === 0) {
        return {
          avgResponseTime: 0,
          successRate: 0,
          errorRate: 0,
          throughput: 0,
          peakHours: [],
          dailyVolume: []
        };
      }

      // Métricas de performance
      const avgResponseTime = events.reduce((sum, e) => sum + e.responseTime, 0) / events.length;
      const successfulEvents = events.filter(e => e.fulfilled).length;
      const successRate = successfulEvents / events.length;
      const errorRate = 1 - successRate;

      // Throughput (mensagens por minuto)
      const timeRangeMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      const throughput = events.length / timeRangeMinutes;

      // Peak hours
      const hourCounts: { [key: number]: number } = {};
      events.forEach(event => {
        const hour = new Date(event.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Daily volume
      const dayCounts: { [key: string]: number } = {};
      events.forEach(event => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        dayCounts[date] = (dayCounts[date] || 0) + 1;
      });

      const dailyVolume = Object.entries(dayCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        avgResponseTime: Math.round(avgResponseTime),
        successRate: Math.round(successRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        peakHours,
        dailyVolume
      };

    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      throw new Error('Failed to get performance metrics');
    }
  }

  async getUserBehaviorMetrics(startDate: Date, endDate: Date): Promise<UserBehaviorMetrics> {
    try {
      const sessionSnapshot = await this.db
        .collection('sessions')
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

      const sessions = sessionSnapshot.docs.map(doc => doc.data());
      
      // Usuários únicos
      const userIds = new Set(sessions.filter(s => s.userId).map(s => s.userId));
      const totalUsers = userIds.size;

      // Novos vs recorrentes (implementação simplificada)
      const newUsers = Math.floor(totalUsers * 0.7);
      const returningUsers = totalUsers - newUsers;

      // Sessões por usuário
      const avgSessionsPerUser = totalUsers > 0 ? sessions.length / totalUsers : 0;

      // Taxa de retenção (implementação simplificada)
      const userRetentionRate = 0.65;

      // Top ações (implementação simplificada baseada em intents)
      const topUserActions = [
        { action: 'get-pricing', count: Math.floor(sessions.length * 0.3) },
        { action: 'company-info', count: Math.floor(sessions.length * 0.25) },
        { action: 'schedule-demo', count: Math.floor(sessions.length * 0.2) },
        { action: 'collect-lead-info', count: Math.floor(sessions.length * 0.15) },
        { action: 'transfer-to-human', count: Math.floor(sessions.length * 0.1) }
      ];

      // Distribuição geográfica (implementação simplificada)
      const geographicDistribution = [
        { region: 'São Paulo', count: Math.floor(sessions.length * 0.4) },
        { region: 'Rio de Janeiro', count: Math.floor(sessions.length * 0.2) },
        { region: 'Minas Gerais', count: Math.floor(sessions.length * 0.15) },
        { region: 'Outros', count: Math.floor(sessions.length * 0.25) }
      ];

      return {
        newUsers,
        returningUsers,
        avgSessionsPerUser: Math.round(avgSessionsPerUser * 10) / 10,
        userRetentionRate: Math.round(userRetentionRate * 100) / 100,
        topUserActions,
        geographicDistribution
      };

    } catch (error) {
      console.error('❌ Error getting user behavior metrics:', error);
      throw new Error('Failed to get user behavior metrics');
    }
  }

  async generateReport(name: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      console.log(`📊 Generating analytics report: ${name}`);

      const [intentMetrics, sessionMetrics, performanceMetrics, userBehaviorMetrics] = await Promise.all([
        this.getIntentMetrics(startDate, endDate),
        this.getSessionMetrics(startDate, endDate),
        this.getPerformanceMetrics(startDate, endDate),
        this.getUserBehaviorMetrics(startDate, endDate)
      ]);

      // Gerar insights e recomendações
      const insights = this.generateInsights(intentMetrics, sessionMetrics, performanceMetrics);
      const recommendations = this.generateRecommendations(intentMetrics, sessionMetrics, performanceMetrics);

      const report: AnalyticsReport = {
        name,
        period: { startDate, endDate },
        intentMetrics,
        sessionMetrics,
        performanceMetrics,
        userBehaviorMetrics,
        insights,
        recommendations,
        createdAt: new Date()
      };

      const docRef = await this.db.collection('analytics_reports').add({
        ...report,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Analytics report generated: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error generating analytics report:', error);
      throw new Error('Failed to generate analytics report');
    }
  }

  private generateInsights(
    intentMetrics: IntentMetrics[], 
    sessionMetrics: SessionMetrics, 
    performanceMetrics: PerformanceMetrics
  ): string[] {
    const insights: string[] = [];

    // Insights sobre intents
    const lowConfidenceIntents = intentMetrics.filter(i => i.avgConfidence < 0.7);
    if (lowConfidenceIntents.length > 0) {
      insights.push(`${lowConfidenceIntents.length} intents têm baixa confiança média (< 70%)`);
    }

    const highEscalationIntents = intentMetrics.filter(i => i.escalationRate > 0.2);
    if (highEscalationIntents.length > 0) {
      insights.push(`${highEscalationIntents.length} intents têm alta taxa de escalação (> 20%)`);
    }

    // Insights sobre sessões
    if (sessionMetrics.completionRate < 0.8) {
      insights.push('Taxa de conclusão de conversas está baixa (< 80%)');
    }

    if (sessionMetrics.escalationRate > 0.15) {
      insights.push('Taxa de escalação está alta (> 15%)');
    }

    // Insights sobre performance
    if (performanceMetrics.avgResponseTime > 2000) {
      insights.push('Tempo médio de resposta está alto (> 2 segundos)');
    }

    if (performanceMetrics.successRate < 0.9) {
      insights.push('Taxa de sucesso está baixa (< 90%)');
    }

    return insights;
  }

  private generateRecommendations(
    intentMetrics: IntentMetrics[], 
    sessionMetrics: SessionMetrics, 
    performanceMetrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Recomendações para intents
    const lowConfidenceIntents = intentMetrics.filter(i => i.avgConfidence < 0.7);
    if (lowConfidenceIntents.length > 0) {
      recommendations.push('Adicionar mais frases de treinamento para intents com baixa confiança');
    }

    const highVolumeIntents = intentMetrics.slice(0, 3);
    recommendations.push(`Otimizar respostas para os intents mais populares: ${highVolumeIntents.map(i => i.intentName).join(', ')}`);

    // Recomendações para sessões
    if (sessionMetrics.escalationRate > 0.15) {
      recommendations.push('Implementar mais automação para reduzir escalações desnecessárias');
    }

    if (sessionMetrics.avgMessagesPerSession > 10) {
      recommendations.push('Simplificar fluxos de conversa para reduzir número de mensagens por sessão');
    }

    // Recomendações para performance
    if (performanceMetrics.avgResponseTime > 2000) {
      recommendations.push('Otimizar tempo de resposta do sistema');
    }

    if (performanceMetrics.errorRate > 0.1) {
      recommendations.push('Investigar e corrigir causas de erros no sistema');
    }

    return recommendations;
  }

  private calculateTrend(intentName: string, startDate: Date, endDate: Date): 'up' | 'down' | 'stable' {
    // Implementação simplificada - em um cenário real, compararia com período anterior
    return 'stable';
  }

  async exportMetricsToCSV(startDate: Date, endDate: Date): Promise<string> {
    try {
      const intentMetrics = await this.getIntentMetrics(startDate, endDate);
      
      let csvContent = 'Intent,Total Requests,Avg Confidence,Fulfillment Rate,Escalation Rate,Avg Response Time,Trend\n';
      
      intentMetrics.forEach(metric => {
        csvContent += `"${metric.intentName}",${metric.totalRequests},${metric.avgConfidence},${metric.fulfillmentRate},${metric.escalationRate},${metric.avgResponseTime},"${metric.trend}"\n`;
      });

      return csvContent;

    } catch (error) {
      console.error('❌ Error exporting metrics to CSV:', error);
      throw new Error('Failed to export metrics to CSV');
    }
  }

  async getDashboardData(period: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalConversations: number;
    avgConfidence: number;
    escalationRate: number;
    topIntents: Array<{ name: string; count: number }>;
    hourlyVolume: Array<{ hour: number; count: number }>;
  }> {
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

    try {
      const [intentMetrics, sessionMetrics, performanceMetrics] = await Promise.all([
        this.getIntentMetrics(startDate, endDate),
        this.getSessionMetrics(startDate, endDate),
        this.getPerformanceMetrics(startDate, endDate)
      ]);

      const totalConversations = sessionMetrics.totalSessions;
      const avgConfidence = intentMetrics.reduce((sum, i) => sum + i.avgConfidence, 0) / intentMetrics.length || 0;
      const escalationRate = sessionMetrics.escalationRate;
      
      const topIntents = intentMetrics
        .slice(0, 5)
        .map(i => ({ name: i.intentName, count: i.totalRequests }));

      return {
        totalConversations,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        escalationRate,
        topIntents,
        hourlyVolume: performanceMetrics.peakHours
      };

    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw new Error('Failed to get dashboard data');
    }
  }
}