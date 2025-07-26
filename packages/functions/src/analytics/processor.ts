import { Message } from 'firebase-functions/v1/pubsub';
import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function analyticsProcessor(message: Message): Promise<void> {
  try {
    const data = JSON.parse(message.data.toString());
    console.log('📊 Processando analytics:', data);
    
    const { sessionId, intentName, timestamp, parameters, responseId } = data;
    
    // Salvar no Firestore para análise em tempo real
    const db = admin.firestore();
    await db.collection('analytics').doc(responseId).set({
      sessionId,
      intentName,
      timestamp: admin.firestore.Timestamp.fromDate(new Date(timestamp)),
      parameters,
      responseId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Enviar para BigQuery para análise histórica
    const dataset = bigquery.dataset('dialogflow_analytics');
    const table = dataset.table('interactions');
    
    const row = {
      session_id: sessionId,
      intent_name: intentName,
      timestamp: timestamp,
      parameters: JSON.stringify(parameters),
      response_id: responseId,
      created_at: new Date().toISOString()
    };
    
    await table.insert([row]);
    
    // Atualizar métricas em tempo real
    await updateRealTimeMetrics(intentName, sessionId);
    
    console.log('✅ Analytics processado com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao processar analytics:', error);
  }
}

async function updateRealTimeMetrics(intentName: string, sessionId: string): Promise<void> {
  const db = admin.firestore();
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  
  const metricsRef = db.collection('metrics').doc(`daily-${today}`);
  
  try {
    await db.runTransaction(async (transaction) => {
      const metricsDoc = await transaction.get(metricsRef);
      
      if (metricsDoc.exists) {
        const data = metricsDoc.data()!;
        
        // Atualizar contadores
        data.totalInteractions = (data.totalInteractions || 0) + 1;
        data.intents[intentName] = (data.intents[intentName] || 0) + 1;
        data.hourlyDistribution[hour] = (data.hourlyDistribution[hour] || 0) + 1;
        
        // Adicionar sessão única se ainda não existe
        if (!data.uniqueSessions.includes(sessionId)) {
          data.uniqueSessions.push(sessionId);
        }
        
        transaction.update(metricsRef, data);
      } else {
        // Criar novo documento de métricas
        const newData = {
          date: today,
          totalInteractions: 1,
          intents: { [intentName]: 1 },
          hourlyDistribution: { [hour]: 1 },
          uniqueSessions: [sessionId],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        transaction.set(metricsRef, newData);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar métricas:', error);
  }
}