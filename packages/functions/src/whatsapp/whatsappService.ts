import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { WhatsAppConversation, WhatsAppMessage, User, Lead } from '../../../shared/src/types/core';
import axios from 'axios';

const db = admin.firestore();

// ========== CONFIGURAÇÕES DO WHATSAPP ==========

interface WhatsAppConfig {
  provider: 'twilio' | 'official';
  accountSid?: string;
  authToken?: string;
  phoneNumber: string;
  webhookUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
}

// ========== WEBHOOK PARA RECEBER MENSAGENS ==========

/**
 * Webhook para receber mensagens do WhatsApp
 */
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
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
      } else {
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
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error);
    res.status(500).send('Erro interno');
  }
});

/**
 * Processar mensagem recebida
 */
async function processIncomingMessage(messageData: any) {
  try {
    const messages = messageData.messages || [];
    const contacts = messageData.contacts || [];
    
    for (const message of messages) {
      const phoneNumber = message.from;
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000);
      
      // Buscar contato
      const contact = contacts.find(c => c.wa_id === phoneNumber);
      const contactName = contact?.profile?.name || phoneNumber;
      
      // Buscar ou criar conversa
      const conversation = await findOrCreateConversation(phoneNumber, contactName);
      
      // Processar conteúdo da mensagem
      const content = await processMessageContent(message);
      
      // Salvar mensagem
      const messageDoc: Partial<WhatsAppMessage> = {
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
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
  }
}

/**
 * Buscar ou criar conversa
 */
async function findOrCreateConversation(phoneNumber: string, contactName: string): Promise<WhatsAppConversation> {
  // Buscar conversa existente em todas as organizações
  const conversationsSnapshot = await db.collectionGroup('whatsapp')
    .where('phoneNumber', '==', phoneNumber)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (!conversationsSnapshot.empty) {
    const doc = conversationsSnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as WhatsAppConversation;
  }
  
  // Se não encontrou, criar nova conversa na organização padrão
  // (em produção, seria necessário identificar a organização pelo número do WhatsApp)
  const defaultOrgSnapshot = await db.collection('organizations').limit(1).get();
  
  if (defaultOrgSnapshot.empty) {
    throw new Error('Nenhuma organização encontrada');
  }
  
  const organizationId = defaultOrgSnapshot.docs[0].id;
  
  const conversationData: Partial<WhatsAppConversation> = {
    organizationId,
    phoneNumber,
    contactName,
    status: 'active',
    isBot: true, // Iniciar com bot por padrão
    botHandoff: false,
    messageCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
  };
  
  const conversationRef = await db.collection('organizations')
    .doc(organizationId)
    .collection('whatsapp')
    .add(conversationData);
  
  return {
    id: conversationRef.id,
    ...conversationData,
  } as WhatsAppConversation;
}

/**
 * Processar conteúdo da mensagem
 */
async function processMessageContent(message: any): Promise<any> {
  const content: any = {};
  
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
async function processWithBot(conversation: WhatsAppConversation, message: Partial<WhatsAppMessage>) {
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
    const response = await sendToDialogflow(
      dialogflowAgent.projectId,
      conversation.phoneNumber,
      message.content?.text || '',
      dialogflowAgent.language
    );
    
    // Processar resposta do bot
    if (response.fulfillmentText) {
      await sendWhatsAppMessage(conversation.organizationId, {
        to: conversation.phoneNumber,
        text: response.fulfillmentText,
      });
    }
    
    // Verificar se deve fazer handoff para humano
    if (response.intent?.displayName === 'handoff.human' || 
        response.fulfillmentText?.includes('[HANDOFF]')) {
      await handoffToHuman(conversation);
    }
    
  } catch (error) {
    console.error('Erro ao processar com bot:', error);
  }
}

/**
 * Enviar mensagem para o Dialogflow
 */
async function sendToDialogflow(
  projectId: string,
  sessionId: string,
  text: string,
  languageCode: string = 'pt-BR'
): Promise<any> {
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
async function handoffToHuman(conversation: WhatsAppConversation) {
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
async function createOrUpdateLeadFromWhatsApp(
  conversation: WhatsAppConversation,
  message: Partial<WhatsAppMessage>
) {
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
          body: message.content?.text || 'Mensagem de mídia',
        },
        metadata: {
          whatsappMessageId: message.messageId,
          phoneNumber: conversation.phoneNumber,
        },
        isRead: false,
        isImportant: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
    } else {
      // Criar novo lead
      const leadData = {
        organizationId: conversation.organizationId,
        name: conversation.contactName || conversation.phoneNumber,
        whatsappPhone: conversation.phoneNumber,
        source: 'whatsapp' as const,
        status: 'new' as const,
        tags: ['whatsapp'],
        customFields: {},
        interactionCount: 1,
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastContactAt: admin.firestore.FieldValue.serverTimestamp(),
        lastInteractionType: 'whatsapp' as const,
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
          body: message.content?.text || 'Primeira mensagem via WhatsApp',
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
  } catch (error) {
    console.error('Erro ao criar/atualizar lead:', error);
  }
}

// ========== CLOUD FUNCTIONS PARA ENVIO DE MENSAGENS ==========

/**
 * Enviar mensagem WhatsApp
 */
export const sendWhatsAppMessage = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    to: string;
    text?: string;
    media?: {
      type: 'image' | 'video' | 'audio' | 'document';
      url: string;
      caption?: string;
      filename?: string;
    };
    template?: {
      name: string;
      language: string;
      parameters?: any[];
    };
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager', 'agent'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para enviar mensagens');
    }
    
    try {
      const result = await sendWhatsAppMessage(user.organizationId, data);
      return result;
    } catch (error) {
      throw new functions.https.HttpsError('internal', 'Erro ao enviar mensagem');
    }
  }
);

/**
 * Função auxiliar para enviar mensagem
 */
async function sendWhatsAppMessage(organizationId: string, messageData: any): Promise<any> {
  // Buscar configuração do WhatsApp da organização
  const configDoc = await db.collection('organizations')
    .doc(organizationId)
    .collection('settings')
    .doc('whatsapp')
    .get();
  
  if (!configDoc.exists) {
    throw new Error('Configuração do WhatsApp não encontrada');
  }
  
  const config = configDoc.data() as WhatsAppConfig;
  
  if (config.provider === 'twilio') {
    return await sendViaTwilio(config, messageData);
  } else if (config.provider === 'official') {
    return await sendViaOfficial(config, messageData);
  } else {
    throw new Error('Provedor de WhatsApp não configurado');
  }
}

/**
 * Enviar via Twilio
 */
async function sendViaTwilio(config: WhatsAppConfig, messageData: any): Promise<any> {
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
  
  const response = await axios.post(twilioUrl, body, {
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
async function sendViaOfficial(config: WhatsAppConfig, messageData: any): Promise<any> {
  const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
  
  const payload: any = {
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
  
  const response = await axios.post(url, payload, {
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
export const listWhatsAppConversations = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    page?: number;
    limit?: number;
    status?: 'active' | 'closed' | 'archived';
    assignedTo?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
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
    
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return {
      conversations,
      pagination: {
        page,
        limit,
        total: snapshot.size,
        hasMore: snapshot.size === limit,
      },
    };
  }
);

/**
 * Obter mensagens da conversa
 */
export const getWhatsAppMessages = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    conversationId: string;
    page?: number;
    limit?: number;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
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
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return {
      messages: messages.reverse(), // Reverter para ordem cronológica
      pagination: {
        page,
        limit,
        hasMore: messagesSnapshot.size === limit,
      },
    };
  }
);

/**
 * Atribuir conversa a agente
 */
export const assignWhatsAppConversation = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    conversationId: string;
    userId: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
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
  }
);

// ========== FUNÇÕES AUXILIARES ==========

async function notifyAvailableAgents(organizationId: string, conversation: WhatsAppConversation) {
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

