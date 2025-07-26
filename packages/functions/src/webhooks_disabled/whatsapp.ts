import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { DialogflowService } from '@nxtai/shared';
import axios from 'axios';
import cors from 'cors';

const corsHandler = cors({ origin: true });

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'nxtai_webhook_token_2025';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

const dialogflowConfig = {
  projectId: process.env.GCLOUD_PROJECT || 'nxt-ai-prod',
  location: 'us-central1',
  agentId: process.env.DIALOGFLOW_AGENT_ID || '',
  languageCode: 'pt-BR'
};

export async function whatsappWebhook(req: Request, res: Response): Promise<void> {
  return corsHandler(req, res, async () => {
    // Verificação do webhook (GET request)
    if (req.method === 'GET') {
      console.log('🔐 WhatsApp webhook verification');
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado com sucesso');
        res.status(200).send(challenge);
        return;
      }
      
      console.log('❌ Falha na verificação do webhook');
      res.sendStatus(403);
      return;
    }

    // Processar mensagem recebida (POST request)
    try {
      console.log('📱 WhatsApp webhook payload:', JSON.stringify(req.body, null, 2));
      
      const { entry } = req.body;
      
      if (!entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        console.log('⚠️ Payload inválido ou mensagem de status');
        res.sendStatus(200);
        return;
      }
      
      const message = entry[0].changes[0].value.messages[0];
      const metadata = entry[0].changes[0].value.metadata;
      const from = message.from;
      const messageId = message.id;
      
      // Verificar se já processamos esta mensagem
      const db = admin.firestore();
      const processedRef = db.collection('processed_messages').doc(messageId);
      const processedDoc = await processedRef.get();
      
      if (processedDoc.exists) {
        console.log('⚠️ Mensagem já processada:', messageId);
        res.sendStatus(200);
        return;
      }
      
      // Marcar mensagem como processada
      await processedRef.set({
        messageId,
        from,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Extrair texto da mensagem
      let messageText = '';
      let messageType = 'text';
      
      if (message.text) {
        messageText = message.text.body;
        messageType = 'text';
      } else if (message.image) {
        messageText = message.image.caption || 'Imagem recebida';
        messageType = 'image';
      } else if (message.document) {
        messageText = message.document.caption || 'Documento recebido';
        messageType = 'document';
      } else if (message.audio) {
        messageText = 'Áudio recebido';
        messageType = 'audio';
      } else if (message.video) {
        messageText = message.video.caption || 'Vídeo recebido';
        messageType = 'video';
      } else {
        messageText = 'Mensagem não suportada';
        messageType = 'unsupported';
      }
      
      console.log(`📨 Mensagem recebida de ${from}: ${messageText}`);
      
      // Buscar ou criar conversa
      const sessionId = `whatsapp-${from}`;
      const conversationRef = db.collection('conversations').doc(sessionId);
      const conversationDoc = await conversationRef.get();
      
      const messageData = {
        id: messageId,
        conversationId: sessionId,
        content: messageText,
        sender: 'user' as const,
        type: messageType as any,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (!conversationDoc.exists) {
        // Criar nova conversa
        await conversationRef.set({
          id: sessionId,
          tenantId: 'default', // TODO: implementar multi-tenant
          sessionId,
          channel: 'whatsapp',
          userId: from,
          status: 'active',
          messages: [messageData],
          metadata: {
            phoneNumber: from,
            displayPhoneNumber: metadata?.display_phone_number,
            phoneNumberId: metadata?.phone_number_id
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Atualizar conversa existente
        await conversationRef.update({
          messages: admin.firestore.FieldValue.arrayUnion(messageData),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'active' // Reativar conversa se estava resolvida
        });
      }
      
      // Processar com Dialogflow apenas para mensagens de texto
      if (messageType === 'text' && messageText.trim()) {
        const dialogflowService = new DialogflowService(dialogflowConfig);
        
        try {
          const dialogflowResponse = await dialogflowService.detectIntent(
            sessionId,
            messageText
          );
          
          console.log('🤖 Resposta do Dialogflow:', dialogflowResponse);
          
          // Salvar resposta do bot na conversa
          const botMessageData = {
            id: `bot-${Date.now()}`,
            conversationId: sessionId,
            content: dialogflowResponse.text,
            sender: 'bot' as const,
            type: 'text' as const,
            intent: dialogflowResponse.intent,
            confidence: dialogflowResponse.confidence,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await conversationRef.update({
            messages: admin.firestore.FieldValue.arrayUnion(botMessageData),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Enviar resposta via WhatsApp
          if (dialogflowResponse.text) {
            await sendWhatsAppMessage(from, dialogflowResponse.text);
          }
          
        } catch (dialogflowError) {
          console.error('❌ Erro no Dialogflow:', dialogflowError);
          
          // Enviar mensagem de erro amigável
          await sendWhatsAppMessage(
            from,
            'Desculpe, estou com algumas dificuldades técnicas no momento. ' +
            'Tente novamente em alguns instantes ou entre em contato pelo telefone (11) 9999-9999.'
          );
        }
      } else if (messageType !== 'text') {
        // Resposta para tipos de mídia não suportados
        await sendWhatsAppMessage(
          from,
          'Recebi sua mensagem! No momento, posso processar apenas mensagens de texto. ' +
          'Como posso ajudar você?'
        );
      }
      
      res.sendStatus(200);
      
    } catch (error) {
      console.error('❌ Erro no webhook WhatsApp:', error);
      res.sendStatus(500);
    }
  });
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('❌ Configurações do WhatsApp não encontradas');
    return;
  }
  
  const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`;
  
  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Mensagem enviada via WhatsApp:', response.data);
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Resposta da API:', error.response?.data);
    }
  }
}

// Função auxiliar para download de mídia (futuro)
async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer | null> {
  if (!WHATSAPP_TOKEN) {
    return null;
  }
  
  try {
    // Primeiro, obter URL da mídia
    const mediaInfoResponse = await axios.get(
      `https://graph.facebook.com/v17.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`
        }
      }
    );
    
    const mediaUrl = mediaInfoResponse.data.url;
    
    // Fazer download da mídia
    const mediaResponse = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`
      }
    });
    
    return Buffer.from(mediaResponse.data);
    
  } catch (error) {
    console.error('❌ Erro ao baixar mídia:', error);
    return null;
  }
}