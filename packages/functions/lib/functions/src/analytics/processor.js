"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsProcessor = analyticsProcessor;
const admin = __importStar(require("firebase-admin"));
const bigquery_1 = require("@google-cloud/bigquery");
const bigquery = new bigquery_1.BigQuery();
async function analyticsProcessor(message) {
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
    }
    catch (error) {
        console.error('❌ Erro ao processar analytics:', error);
    }
}
async function updateRealTimeMetrics(intentName, sessionId) {
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const metricsRef = db.collection('metrics').doc(`daily-${today}`);
    try {
        await db.runTransaction(async (transaction) => {
            const metricsDoc = await transaction.get(metricsRef);
            if (metricsDoc.exists) {
                const data = metricsDoc.data();
                // Atualizar contadores
                data.totalInteractions = (data.totalInteractions || 0) + 1;
                data.intents[intentName] = (data.intents[intentName] || 0) + 1;
                data.hourlyDistribution[hour] = (data.hourlyDistribution[hour] || 0) + 1;
                // Adicionar sessão única se ainda não existe
                if (!data.uniqueSessions.includes(sessionId)) {
                    data.uniqueSessions.push(sessionId);
                }
                transaction.update(metricsRef, data);
            }
            else {
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
    }
    catch (error) {
        console.error('❌ Erro ao atualizar métricas:', error);
    }
}
//# sourceMappingURL=processor.js.map