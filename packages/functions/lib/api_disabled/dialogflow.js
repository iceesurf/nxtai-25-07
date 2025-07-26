"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDialogflowAgents = exports.dialogflowWebhook = exports.createIntent = exports.detectIntent = void 0;
const https_1 = require("firebase-functions/v2/https");
const dialogflow_cx_1 = require("@google-cloud/dialogflow-cx");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const db = (0, firestore_1.getFirestore)();
// Schemas de validação
const detectIntentSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    text: zod_1.z.string(),
    languageCode: zod_1.z.string().default('pt-BR'),
});
const createIntentSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    displayName: zod_1.z.string(),
    trainingPhrases: zod_1.z.array(zod_1.z.string()),
    parameters: zod_1.z.array(zod_1.z.object({
        displayName: zod_1.z.string(),
        entityType: zod_1.z.string(),
        required: zod_1.z.boolean().default(false),
    })).optional(),
    responses: zod_1.z.array(zod_1.z.string()),
});
// Detectar intenção
exports.detectIntent = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    var _a;
    try {
        const { data, auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        const validatedData = detectIntentSchema.parse(data);
        const { agentId, sessionId, text, languageCode } = validatedData;
        logger_1.logger.info('Detecting intent', { agentId, sessionId, text });
        // Verificar se o agente existe e o usuário tem permissão
        const agentDoc = await db.collection('agents').doc(agentId).get();
        if (!agentDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Agent not found');
        }
        const agent = agentDoc.data();
        // Verificar permissões de organização
        if (agent.organizationId) {
            const userDoc = await db.collection('users').doc(authContext.uid).get();
            const userData = userDoc.data();
            if ((userData === null || userData === void 0 ? void 0 : userData.organizationId) !== agent.organizationId) {
                throw new https_1.HttpsError('permission-denied', 'Access denied to this agent');
            }
        }
        // Configurar cliente Dialogflow
        const sessionClient = new dialogflow_cx_1.SessionsClient();
        const sessionPath = sessionClient.projectLocationAgentSessionPath(agent.dialogflowConfig.projectId, agent.dialogflowConfig.location, agent.dialogflowConfig.agentId, sessionId);
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
        const intent = queryResult === null || queryResult === void 0 ? void 0 : queryResult.intent;
        const responseMessages = (queryResult === null || queryResult === void 0 ? void 0 : queryResult.responseMessages) || [];
        // Salvar mensagem no Firestore
        const conversationId = `${agentId}_${sessionId}`;
        const messageData = {
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
                    confidence: (queryResult === null || queryResult === void 0 ? void 0 : queryResult.intentDetectionConfidence) || 0,
                    parameters: (queryResult === null || queryResult === void 0 ? void 0 : queryResult.parameters) || {},
                } : undefined,
                sentiment: (queryResult === null || queryResult === void 0 ? void 0 : queryResult.sentimentAnalysisResult) ? {
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
            var _a;
            if (msg.text) {
                return ((_a = msg.text.text) === null || _a === void 0 ? void 0 : _a[0]) || '';
            }
            return '';
        }).filter(Boolean).join(' ') || agent.configuration.fallbackMessage;
        // Salvar resposta do agente
        const agentMessageData = {
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
            averageResponseTime: ((_a = response.responseTime) === null || _a === void 0 ? void 0 : _a.seconds) || 1,
            lastActive: new Date(),
        });
        logger_1.logger.info('Intent detected successfully', {
            agentId,
            sessionId,
            intent: intent === null || intent === void 0 ? void 0 : intent.displayName
        });
        return {
            success: true,
            data: {
                intent: intent ? {
                    name: intent.name,
                    displayName: intent.displayName,
                    confidence: queryResult === null || queryResult === void 0 ? void 0 : queryResult.intentDetectionConfidence,
                } : null,
                response: agentResponse,
                parameters: queryResult === null || queryResult === void 0 ? void 0 : queryResult.parameters,
                sessionId,
                conversationId,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error detecting intent', error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid input data', error.errors);
        }
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Intent detection failed');
    }
});
// Criar nova intenção
exports.createIntent = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    var _a;
    try {
        const { data, auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        const validatedData = createIntentSchema.parse(data);
        const { agentId, displayName, trainingPhrases, parameters, responses } = validatedData;
        logger_1.logger.info('Creating intent', { agentId, displayName });
        // Verificar permissões
        const agentDoc = await db.collection('agents').doc(agentId).get();
        if (!agentDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Agent not found');
        }
        const agent = agentDoc.data();
        // Verificar permissões de organização
        if (agent.organizationId) {
            const userDoc = await db.collection('users').doc(authContext.uid).get();
            const userData = userDoc.data();
            if ((userData === null || userData === void 0 ? void 0 : userData.organizationId) !== agent.organizationId) {
                throw new https_1.HttpsError('permission-denied', 'Access denied to this agent');
            }
        }
        // Configurar cliente Dialogflow
        const intentsClient = new dialogflow_cx_1.IntentsClient();
        const agentPath = intentsClient.projectLocationAgentPath(agent.dialogflowConfig.projectId, agent.dialogflowConfig.location, agent.dialogflowConfig.agentId);
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
        const formattedParameters = (parameters === null || parameters === void 0 ? void 0 : parameters.map(param => ({
            displayName: param.displayName,
            entityType: param.entityType,
            required: param.required,
        }))) || [];
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
        logger_1.logger.info('Intent created successfully', {
            agentId,
            intentId: intent.name,
            displayName
        });
        return {
            success: true,
            data: {
                intentId: intent.name,
                displayName: intent.displayName,
                trainingPhrases: ((_a = intent.trainingPhrases) === null || _a === void 0 ? void 0 : _a.length) || 0,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error creating intent', error);
        if (error instanceof zod_1.z.ZodError) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid input data', error.errors);
        }
        throw new https_1.HttpsError('internal', 'Intent creation failed');
    }
});
// Webhook para Dialogflow
exports.dialogflowWebhook = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
}, async (req, res) => {
    var _a, _b;
    try {
        const { queryResult, sessionInfo } = req.body;
        logger_1.logger.info('Dialogflow webhook received', {
            intent: (_a = queryResult === null || queryResult === void 0 ? void 0 : queryResult.intent) === null || _a === void 0 ? void 0 : _a.displayName,
            sessionId: sessionInfo === null || sessionInfo === void 0 ? void 0 : sessionInfo.session,
        });
        // Processar intent e preparar resposta
        const intentName = (_b = queryResult === null || queryResult === void 0 ? void 0 : queryResult.intent) === null || _b === void 0 ? void 0 : _b.displayName;
        const parameters = (queryResult === null || queryResult === void 0 ? void 0 : queryResult.parameters) || {};
        const text = (queryResult === null || queryResult === void 0 ? void 0 : queryResult.text) || '';
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
    }
    catch (error) {
        logger_1.logger.error('Error in Dialogflow webhook', error);
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
});
// Listar agentes Dialogflow
exports.listDialogflowAgents = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1',
}, async (request) => {
    try {
        const { auth: authContext } = request;
        if (!(authContext === null || authContext === void 0 ? void 0 : authContext.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'Authentication required');
        }
        // Obter project ID do usuário/organização
        const userDoc = await db.collection('users').doc(authContext.uid).get();
        const userData = userDoc.data();
        if (!(userData === null || userData === void 0 ? void 0 : userData.organizationId)) {
            throw new https_1.HttpsError('permission-denied', 'Organization required');
        }
        // TODO: Implementar listagem de agentes Dialogflow
        // Por enquanto, retornar agentes do Firestore
        const agentsSnapshot = await db
            .collection('agents')
            .where('organizationId', '==', userData.organizationId)
            .get();
        const agents = agentsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return {
            success: true,
            data: agents,
        };
    }
    catch (error) {
        logger_1.logger.error('Error listing Dialogflow agents', error);
        throw new https_1.HttpsError('internal', 'Failed to list agents');
    }
});
// Funções auxiliares para webhook
async function handleUserInfoIntent(parameters) {
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
async function handleScheduleIntent(parameters) {
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
async function handleProductSearchIntent(parameters) {
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
async function updateAgentMetrics(agentId, metrics) {
    try {
        await db.collection('agents').doc(agentId).update({
            'metrics.totalConversations': db.FieldValue.increment(metrics.totalConversations || 0),
            'metrics.lastActive': metrics.lastActive || new Date(),
            updatedAt: new Date(),
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating agent metrics', error);
    }
}
//# sourceMappingURL=dialogflow.js.map