import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { SessionsClient, IntentsClient, AgentsClient } from '@google-cloud/dialogflow-cx';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { validateAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Agent, Conversation, Message } from '@nxtai/shared';

const db = getFirestore();

// Schemas de validação
const detectIntentSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  text: z.string(),
  languageCode: z.string().default('pt-BR'),
});

const createIntentSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  trainingPhrases: z.array(z.string()),
  parameters: z.array(z.object({
    displayName: z.string(),
    entityType: z.string(),
    required: z.boolean().default(false),
  })).optional(),
  responses: z.array(z.string()),
});

// Detectar intenção
export const detectIntent = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { data, auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const validatedData = detectIntentSchema.parse(data);
      const { agentId, sessionId, text, languageCode } = validatedData;

      logger.info('Detecting intent', { agentId, sessionId, text });

      // Verificar se o agente existe e o usuário tem permissão
      const agentDoc = await db.collection('agents').doc(agentId).get();
      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      const agent = agentDoc.data() as Agent;
      
      // Verificar permissões de organização
      if (agent.organizationId) {
        const userDoc = await db.collection('users').doc(authContext.uid).get();
        const userData = userDoc.data();
        
        if (userData?.organizationId !== agent.organizationId) {
          throw new HttpsError('permission-denied', 'Access denied to this agent');
        }
      }

      // Configurar cliente Dialogflow
      const sessionClient = new SessionsClient();
      const sessionPath = sessionClient.projectLocationAgentSessionPath(
        agent.dialogflowConfig.projectId,
        agent.dialogflowConfig.location,
        agent.dialogflowConfig.agentId,
        sessionId
      );

      // Preparar request para Dialogflow
      const dialogflowRequest = {
        session: sessionPath,
        queryInput: {
          text: {
            text: text,
          },
          languageCode: languageCode,
        },
      };

      // Detectar intenção
      const [response] = await sessionClient.detectIntent(dialogflowRequest);

      // Processar resposta
      const queryResult = response.queryResult;
      const intent = queryResult?.intent;
      const responseMessages = queryResult?.responseMessages || [];

      // Salvar mensagem no Firestore
      const conversationId = `${agentId}_${sessionId}`;
      const messageData: Partial<Message> = {
        conversationId,
        type: 'text',
        direction: 'inbound',
        content: { text },
        sender: {
          id: authContext.uid,
          type: 'user',
        },
        status: 'delivered',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          platform: 'web',
          processedAt: new Date(),
          intent: intent ? {
            name: intent.name || '',
            displayName: intent.displayName || '',
            confidence: queryResult?.intentDetectionConfidence || 0,
            parameters: queryResult?.parameters || {},
          } : undefined,
          sentiment: queryResult?.sentimentAnalysisResult ? {
            score: queryResult.sentimentAnalysisResult.score || 0,
            magnitude: queryResult.sentimentAnalysisResult.magnitude || 0,
            label: queryResult.sentimentAnalysisResult.score > 0.1 ? 'positive' : 
                   queryResult.sentimentAnalysisResult.score < -0.1 ? 'negative' : 'neutral',
          } : undefined,
          languageDetection: {
            language: languageCode,
            confidence: 1.0,
          },
        },
      };

      await db.collection('messages').add(messageData);

      // Preparar resposta do agente
      const agentResponse = responseMessages.map(msg => {
        if (msg.text) {
          return msg.text.text?.[0] || '';
        }
        return '';
      }).filter(Boolean).join(' ') || agent.configuration.fallbackMessage;

      // Salvar resposta do agente
      const agentMessageData: Partial<Message> = {
        conversationId,
        type: 'text',
        direction: 'outbound',
        content: { text: agentResponse },
        sender: {
          id: agentId,
          name: agent.name,
          type: 'agent',
        },
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          platform: 'web',
          processedAt: new Date(),
        },
      };

      await db.collection('messages').add(agentMessageData);

      // Atualizar métricas do agente
      await updateAgentMetrics(agentId, {
        totalConversations: 1,
        averageResponseTime: response.responseTime?.seconds || 1,
        lastActive: new Date(),
      });

      logger.info('Intent detected successfully', { 
        agentId, 
        sessionId, 
        intent: intent?.displayName 
      });

      return {
        success: true,
        data: {
          intent: intent ? {
            name: intent.name,
            displayName: intent.displayName,
            confidence: queryResult?.intentDetectionConfidence,
          } : null,
          response: agentResponse,
          parameters: queryResult?.parameters,
          sessionId,
          conversationId,
        },
      };

    } catch (error) {
      logger.error('Error detecting intent', error);
      
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', 'Invalid input data', error.errors);
      }
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', 'Intent detection failed');
    }
  }
);

// Criar nova intenção
export const createIntent = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { data, auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const validatedData = createIntentSchema.parse(data);
      const { agentId, displayName, trainingPhrases, parameters, responses } = validatedData;

      logger.info('Creating intent', { agentId, displayName });

      // Verificar permissões
      const agentDoc = await db.collection('agents').doc(agentId).get();
      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      const agent = agentDoc.data() as Agent;
      
      // Verificar permissões de organização
      if (agent.organizationId) {
        const userDoc = await db.collection('users').doc(authContext.uid).get();
        const userData = userDoc.data();
        
        if (userData?.organizationId !== agent.organizationId) {
          throw new HttpsError('permission-denied', 'Access denied to this agent');
        }
      }

      // Configurar cliente Dialogflow
      const intentsClient = new IntentsClient();
      const agentPath = intentsClient.projectLocationAgentPath(
        agent.dialogflowConfig.projectId,
        agent.dialogflowConfig.location,
        agent.dialogflowConfig.agentId
      );

      // Preparar training phrases
      const formattedTrainingPhrases = trainingPhrases.map(phrase => ({
        parts: [{ text: phrase }],
        repeatCount: 1,
      }));

      // Preparar responses
      const formattedResponses = responses.map(response => ({
        text: { text: [response] },
      }));

      // Preparar parâmetros se fornecidos
      const formattedParameters = parameters?.map(param => ({
        displayName: param.displayName,
        entityType: param.entityType,
        required: param.required,
      })) || [];

      // Criar intenção no Dialogflow
      const intentRequest = {
        parent: agentPath,
        intent: {
          displayName,
          trainingPhrases: formattedTrainingPhrases,
          parameters: formattedParameters,
          messages: formattedResponses,
        },
      };

      const [operation] = await intentsClient.createIntent(intentRequest);
      const [intent] = await operation.promise();

      logger.info('Intent created successfully', { 
        agentId, 
        intentId: intent.name,
        displayName 
      });

      return {
        success: true,
        data: {
          intentId: intent.name,
          displayName: intent.displayName,
          trainingPhrases: intent.trainingPhrases?.length || 0,
        },
      };

    } catch (error) {
      logger.error('Error creating intent', error);
      
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', 'Invalid input data', error.errors);
      }
      
      throw new HttpsError('internal', 'Intent creation failed');
    }
  }
);

// Webhook para Dialogflow
export const dialogflowWebhook = onRequest(
  {
    cors: true,
    region: 'us-central1',
  },
  async (req, res) => {
    try {
      const { queryResult, sessionInfo } = req.body;
      
      logger.info('Dialogflow webhook received', { 
        intent: queryResult?.intent?.displayName,
        sessionId: sessionInfo?.session,
      });

      // Processar intent e preparar resposta
      const intentName = queryResult?.intent?.displayName;
      const parameters = queryResult?.parameters || {};
      const text = queryResult?.text || '';

      // Lógica de negócio baseada na intenção
      let webhookResponse = {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Entendi sua solicitação. Como posso ajudar mais?'],
              },
            },
          ],
        },
      };

      // Implementar lógica específica por intenção
      switch (intentName) {
        case 'get.user.info':
          webhookResponse = await handleUserInfoIntent(parameters);
          break;
        case 'schedule.appointment':
          webhookResponse = await handleScheduleIntent(parameters);
          break;
        case 'product.search':
          webhookResponse = await handleProductSearchIntent(parameters);
          break;
        default:
          // Usar resposta padrão
          break;
      }

      res.json(webhookResponse);

    } catch (error) {
      logger.error('Error in Dialogflow webhook', error);
      
      res.json({
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Desculpe, ocorreu um erro. Tente novamente em alguns instantes.'],
              },
            },
          ],
        },
      });
    }
  }
);

// Listar agentes Dialogflow
export const listDialogflowAgents = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request) => {
    try {
      const { auth: authContext } = request;
      
      if (!authContext?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      // Obter project ID do usuário/organização
      const userDoc = await db.collection('users').doc(authContext.uid).get();
      const userData = userDoc.data();

      if (!userData?.organizationId) {
        throw new HttpsError('permission-denied', 'Organization required');
      }

      // TODO: Implementar listagem de agentes Dialogflow
      // Por enquanto, retornar agentes do Firestore
      const agentsSnapshot = await db
        .collection('agents')
        .where('organizationId', '==', userData.organizationId)
        .get();

      const agents = agentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        data: agents,
      };

    } catch (error) {
      logger.error('Error listing Dialogflow agents', error);
      throw new HttpsError('internal', 'Failed to list agents');
    }
  }
);

// Funções auxiliares para webhook
async function handleUserInfoIntent(parameters: any) {
  // Implementar lógica para buscar informações do usuário
  return {
    fulfillmentResponse: {
      messages: [
        {
          text: {
            text: ['Aqui estão suas informações de perfil...'],
          },
        },
      ],
    },
  };
}

async function handleScheduleIntent(parameters: any) {
  // Implementar lógica para agendamento
  return {
    fulfillmentResponse: {
      messages: [
        {
          text: {
            text: ['Agendamento realizado com sucesso!'],
          },
        },
      ],
    },
  };
}

async function handleProductSearchIntent(parameters: any) {
  // Implementar lógica para busca de produtos
  return {
    fulfillmentResponse: {
      messages: [
        {
          text: {
            text: ['Encontrei alguns produtos para você...'],
          },
        },
      ],
    },
  };
}

async function updateAgentMetrics(agentId: string, metrics: Partial<any>) {
  try {
    await db.collection('agents').doc(agentId).update({
      'metrics.totalConversations': db.FieldValue.increment(metrics.totalConversations || 0),
      'metrics.lastActive': metrics.lastActive || new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    logger.error('Error updating agent metrics', error);
  }
}