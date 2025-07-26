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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignWhatsAppConversation = exports.getWhatsAppMessages = exports.listWhatsAppConversations = exports.sendWhatsAppMessage = exports.whatsappWebhook = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const db = admin.firestore();
// ========== WEBHOOK PARA RECEBER MENSAGENS ==========
/**
 * Webhook para receber mensagens do WhatsApp
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    try {
        // Verificação do webhook (GET)
        if (req.method === 'GET') {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            // Verificar token de verificação
            const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nxtai_webhook_token';
            if (mode === 'subscribe' && token === verifyToken) {
                console.log('Webhook verificado com sucesso');
                res.status(200).send(challenge);
                return;
            }
            else {
                res.status(403).send('Token de verificação inválido');
                return;
            }
        }
        // Processar mensagens recebidas (POST)
        if (req.method === 'POST') {
            const body = req.body;
            // Verificar se é uma mensagem do WhatsApp
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        if (change.field === 'messages') {
                            await processIncomingMessage(change.value);
                        }
                    }
                }
            }
            res.status(200).send('OK');
            return;
        }
        res.status(405).send('Método não permitido');
    }
    catch (error) {
        console.error('Erro no webhook WhatsApp:', error);
        res.status(500).send('Erro interno');
    }
});
/**
 * Processar mensagem recebida
 */
async function processIncomingMessage(messageData) {
    var _a;
    try {
        const messages = messageData.messages || [];
        const contacts = messageData.contacts || [];
        for (const message of messages) {
            const phoneNumber = message.from;
            const messageId = message.id;
            const timestamp = new Date(parseInt(message.timestamp) * 1000);
            // Buscar contato
            const contact = contacts.find(c => c.wa_id === phoneNumber);
            const contactName = ((_a = contact === null || contact === void 0 ? void 0 : contact.profile) === null || _a === void 0 ? void 0 : _a.name) || phoneNumber;
            // Buscar ou criar conversa
            const conversation = await findOrCreateConversation(phoneNumber, contactName);
            // Processar conteúdo da mensagem
            const content = await processMessageContent(message);
            // Salvar mensagem
            const messageDoc = {
                organizationId: conversation.organizationId,
                conversationId: conversation.id,
                content,
                direction: 'inbound',
                messageId,
                status: 'delivered',
                from: {
                    phoneNumber,
                    name: contactName,
                    isBot: false,
                },
                createdAt: admin.firestore.Timestamp.fromDate(timestamp),
            };
            await db.collection('organizations')
                .doc(conversation.organizationId)
                .collection('whatsapp')
                .doc(conversation.id)
                .collection('messages')
                .add(messageDoc);
            // Atualizar conversa
            await db.collection('organizations')
                .doc(conversation.organizationId)
                .collection('whatsapp')
                .doc(conversation.id)
                .update({
                messageCount: admin.firestore.FieldValue.increment(1),
                lastMessageAt: admin.firestore.Timestamp.fromDate(timestamp),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Processar com bot se configurado
            if (conversation.isBot && !conversation.botHandoff) {
                await processWithBot(conversation, messageDoc);
            }
            // Criar/atualizar lead se necessário
            await createOrUpdateLeadFromWhatsApp(conversation, messageDoc);
        }
    }
    catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
}
/**
 * Buscar ou criar conversa
 */
async function findOrCreateConversation(phoneNumber, contactName) {
    // Buscar conversa existente em todas as organizações
    const conversationsSnapshot = await db.collectionGroup('whatsapp')
        .where('phoneNumber', '==', phoneNumber)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (!conversationsSnapshot.empty) {
        const doc = conversationsSnapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }
    // Se não encontrou, criar nova conversa na organização padrão
    // (em produção, seria necessário identificar a organização pelo número do WhatsApp)
    const defaultOrgSnapshot = await db.collection('organizations').limit(1).get();
    if (defaultOrgSnapshot.empty) {
        throw new Error('Nenhuma organização encontrada');
    }
    const organizationId = defaultOrgSnapshot.docs[0].id;
    const conversationData = {
        organizationId,
        phoneNumber,
        contactName,
        status: 'active',
        isBot: true, // Iniciar com bot por padrão
        botHandoff: false,
        messageCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const conversationRef = await db.collection('organizations')
        .doc(organizationId)
        .collection('whatsapp')
        .add(conversationData);
    return Object.assign({ id: conversationRef.id }, conversationData);
}
/**
 * Processar conteúdo da mensagem
 */
async function processMessageContent(message) {
    const content = {};
    if (message.text) {
        content.text = message.text.body;
    }
    if (message.image) {
        content.media = {
            type: 'image',
            url: message.image.id, // ID da mídia no WhatsApp
            caption: message.image.caption,
        };
    }
    if (message.video) {
        content.media = {
            type: 'video',
            url: message.video.id,
            caption: message.video.caption,
        };
    }
    if (message.audio) {
        content.media = {
            type: 'audio',
            url: message.audio.id,
        };
    }
    if (message.document) {
        content.media = {
            type: 'document',
            url: message.document.id,
            filename: message.document.filename,
            caption: message.document.caption,
        };
    }
    if (message.location) {
        content.location = {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            name: message.location.name,
            address: message.location.address,
        };
    }
    return content;
}
/**
 * Processar mensagem com bot (Dialogflow)
 */
async function processWithBot(conversation, message) {
    var _a, _b, _c;
    try {
        // Buscar configuração do Dialogflow da organização
        const dialogflowSnapshot = await db.collection('organizations')
            .doc(conversation.organizationId)
            .collection('dialogflow')
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (dialogflowSnapshot.empty) {
            console.log('Nenhum agente Dialogflow ativo encontrado');
            return;
        }
        const dialogflowAgent = dialogflowSnapshot.docs[0].data();
        // Enviar mensagem para o Dialogflow
        const response = await sendToDialogflow(dialogflowAgent.projectId, conversation.phoneNumber, ((_a = message.content) === null || _a === void 0 ? void 0 : _a.text) || '', dialogflowAgent.language);
        // Processar resposta do bot
        if (response.fulfillmentText) {
            await sendWhatsAppMessage(conversation.organizationId, {
                to: conversation.phoneNumber,
                text: response.fulfillmentText,
            });
        }
        // Verificar se deve fazer handoff para humano
        if (((_b = response.intent) === null || _b === void 0 ? void 0 : _b.displayName) === 'handoff.human' ||
            ((_c = response.fulfillmentText) === null || _c === void 0 ? void 0 : _c.includes('[HANDOFF]'))) {
            await handoffToHuman(conversation);
        }
    }
    catch (error) {
        console.error('Erro ao processar com bot:', error);
    }
}
/**
 * Enviar mensagem para o Dialogflow
 */
async function sendToDialogflow(projectId, sessionId, text, languageCode = 'pt-BR') {
    // Implementação simplificada - em produção usaria a biblioteca oficial do Dialogflow
    const sessionPath = `projects/${projectId}/agent/sessions/${sessionId}`;
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: text,
                languageCode: languageCode,
            },
        },
    };
    // Aqui seria feita a chamada real para o Dialogflow
    // Por simplicidade, retornando uma resposta mock
    return {
        fulfillmentText: 'Olá! Como posso ajudá-lo?',
        intent: {
            displayName: 'Default Welcome Intent',
        },
    };
}
/**
 * Fazer handoff para humano
 */
async function handoffToHuman(conversation) {
    await db.collection('organizations')
        .doc(conversation.organizationId)
        .collection('whatsapp')
        .doc(conversation.id)
        .update({
        botHandoff: true,
        handoffAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Enviar mensagem de handoff
    await sendWhatsAppMessage(conversation.organizationId, {
        to: conversation.phoneNumber,
        text: 'Você está sendo transferido para um de nossos consultores. Aguarde um momento.',
    });
    // Notificar agentes disponíveis
    await notifyAvailableAgents(conversation.organizationId, conversation);
}
/**
 * Criar ou atualizar lead a partir do WhatsApp
 */
async function createOrUpdateLeadFromWhatsApp(conversation, message) {
    var _a, _b;
    try {
        // Buscar lead existente pelo telefone
        const leadsSnapshot = await db.collection('organizations')
            .doc(conversation.organizationId)
            .collection('leads')
            .where('whatsappPhone', '==', conversation.phoneNumber)
            .limit(1)
            .get();
        if (!leadsSnapshot.empty) {
            // Atualizar lead existente
            const leadDoc = leadsSnapshot.docs[0];
            await leadDoc.ref.update({
                lastContactAt: admin.firestore.FieldValue.serverTimestamp(),
                lastInteractionType: 'whatsapp',
                interactionCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Adicionar interação
            await leadDoc.ref.collection('interactions').add({
                organizationId: conversation.organizationId,
                leadId: leadDoc.id,
                type: 'whatsapp',
                direction: 'inbound',
                content: {
                    body: ((_a = message.content) === null || _a === void 0 ? void 0 : _a.text) || 'Mensagem de mídia',
                },
                metadata: {
                    whatsappMessageId: message.messageId,
                    phoneNumber: conversation.phoneNumber,
                },
                isRead: false,
                isImportant: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            // Criar novo lead
            const leadData = {
                organizationId: conversation.organizationId,
                name: conversation.contactName || conversation.phoneNumber,
                whatsappPhone: conversation.phoneNumber,
                source: 'whatsapp',
                status: 'new',
                tags: ['whatsapp'],
                customFields: {},
                interactionCount: 1,
                isArchived: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastContactAt: admin.firestore.FieldValue.serverTimestamp(),
                lastInteractionType: 'whatsapp',
            };
            const leadRef = await db.collection('organizations')
                .doc(conversation.organizationId)
                .collection('leads')
                .add(leadData);
            // Adicionar interação inicial
            await leadRef.collection('interactions').add({
                organizationId: conversation.organizationId,
                leadId: leadRef.id,
                type: 'whatsapp',
                direction: 'inbound',
                content: {
                    body: ((_b = message.content) === null || _b === void 0 ? void 0 : _b.text) || 'Primeira mensagem via WhatsApp',
                },
                metadata: {
                    whatsappMessageId: message.messageId,
                    phoneNumber: conversation.phoneNumber,
                },
                isRead: false,
                isImportant: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Atualizar conversa com leadId
            await db.collection('organizations')
                .doc(conversation.organizationId)
                .collection('whatsapp')
                .doc(conversation.id)
                .update({
                leadId: leadRef.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    catch (error) {
        console.error('Erro ao criar/atualizar lead:', error);
    }
}
// ========== CLOUD FUNCTIONS PARA ENVIO DE MENSAGENS ==========
/**
 * Enviar mensagem WhatsApp
 */
exports.sendWhatsAppMessage = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager', 'agent'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para enviar mensagens');
    }
    try {
        const result = await sendWhatsAppMessage(user.organizationId, data);
        return result;
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', 'Erro ao enviar mensagem');
    }
});
/**
 * Função auxiliar para enviar mensagem
 */
async function sendWhatsAppMessage(organizationId, messageData) {
    // Buscar configuração do WhatsApp da organização
    const configDoc = await db.collection('organizations')
        .doc(organizationId)
        .collection('settings')
        .doc('whatsapp')
        .get();
    if (!configDoc.exists) {
        throw new Error('Configuração do WhatsApp não encontrada');
    }
    const config = configDoc.data();
    if (config.provider === 'twilio') {
        return await sendViaTwilio(config, messageData);
    }
    else if (config.provider === 'official') {
        return await sendViaOfficial(config, messageData);
    }
    else {
        throw new Error('Provedor de WhatsApp não configurado');
    }
}
/**
 * Enviar via Twilio
 */
async function sendViaTwilio(config, messageData) {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    const body = new URLSearchParams();
    body.append('From', `whatsapp:${config.phoneNumber}`);
    body.append('To', `whatsapp:${messageData.to}`);
    if (messageData.text) {
        body.append('Body', messageData.text);
    }
    if (messageData.media) {
        body.append('MediaUrl', messageData.media.url);
    }
    const response = await axios_1.default.post(twilioUrl, body, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    return response.data;
}
/**
 * Enviar via API oficial do WhatsApp
 */
async function sendViaOfficial(config, messageData) {
    const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: messageData.to,
    };
    if (messageData.text) {
        payload.type = 'text';
        payload.text = { body: messageData.text };
    }
    if (messageData.media) {
        payload.type = messageData.media.type;
        payload[messageData.media.type] = {
            link: messageData.media.url,
            caption: messageData.media.caption,
        };
    }
    if (messageData.template) {
        payload.type = 'template';
        payload.template = messageData.template;
    }
    const response = await axios_1.default.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
}
/**
 * Listar conversas
 */
exports.listWhatsAppConversations = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    const page = data.page || 1;
    const limit = Math.min(data.limit || 20, 100);
    const offset = (page - 1) * limit;
    let query = db.collection('organizations')
        .doc(user.organizationId)
        .collection('whatsapp')
        .orderBy('lastMessageAt', 'desc');
    if (data.status) {
        query = query.where('status', '==', data.status);
    }
    if (data.assignedTo) {
        query = query.where('assignedTo', '==', data.assignedTo);
    }
    const snapshot = await query.limit(limit).offset(offset).get();
    const conversations = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    return {
        conversations,
        pagination: {
            page,
            limit,
            total: snapshot.size,
            hasMore: snapshot.size === limit,
        },
    };
});
/**
 * Obter mensagens da conversa
 */
exports.getWhatsAppMessages = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    const page = data.page || 1;
    const limit = Math.min(data.limit || 50, 100);
    const offset = (page - 1) * limit;
    const messagesSnapshot = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('whatsapp')
        .doc(data.conversationId)
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
    const messages = messagesSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    return {
        messages: messages.reverse(), // Reverter para ordem cronológica
        pagination: {
            page,
            limit,
            hasMore: messagesSnapshot.size === limit,
        },
    };
});
/**
 * Atribuir conversa a agente
 */
exports.assignWhatsAppConversation = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para atribuir conversas');
    }
    await db.collection('organizations')
        .doc(user.organizationId)
        .collection('whatsapp')
        .doc(data.conversationId)
        .update({
        assignedTo: data.userId,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// ========== FUNÇÕES AUXILIARES ==========
async function notifyAvailableAgents(organizationId, conversation) {
    // Buscar agentes disponíveis
    const agentsSnapshot = await db.collection('organizations')
        .doc(organizationId)
        .collection('users')
        .where('role', 'in', ['admin', 'manager', 'agent'])
        .where('status', '==', 'active')
        .get();
    // Criar notificação para cada agente
    const batch = db.batch();
    agentsSnapshot.docs.forEach(agentDoc => {
        const notificationRef = db.collection('organizations')
            .doc(organizationId)
            .collection('notifications')
            .doc();
        batch.set(notificationRef, {
            organizationId,
            userId: agentDoc.id,
            title: 'Nova conversa WhatsApp',
            message: `Nova conversa de ${conversation.contactName || conversation.phoneNumber}`,
            type: 'info',
            action: {
                type: 'navigate',
                payload: {
                    route: '/whatsapp',
                    conversationId: conversation.id,
                },
            },
            isRead: false,
            isArchived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
}
//# sourceMappingURL=whatsappService.js.map