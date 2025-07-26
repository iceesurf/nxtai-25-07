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
exports.whatsappWebhook = whatsappWebhook;
const admin = __importStar(require("firebase-admin"));
const shared_1 = require("@nxtai/shared");
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'nxtai_webhook_token_2025';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const dialogflowConfig = {
    projectId: process.env.GCLOUD_PROJECT || 'nxt-ai-prod',
    location: 'us-central1',
    agentId: process.env.DIALOGFLOW_AGENT_ID || '',
    languageCode: 'pt-BR'
};
async function whatsappWebhook(req, res) {
    return corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e;
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
            if (!((_e = (_d = (_c = (_b = (_a = entry === null || entry === void 0 ? void 0 : entry[0]) === null || _a === void 0 ? void 0 : _a.changes) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.value) === null || _d === void 0 ? void 0 : _d.messages) === null || _e === void 0 ? void 0 : _e[0])) {
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
            }
            else if (message.image) {
                messageText = message.image.caption || 'Imagem recebida';
                messageType = 'image';
            }
            else if (message.document) {
                messageText = message.document.caption || 'Documento recebido';
                messageType = 'document';
            }
            else if (message.audio) {
                messageText = 'Áudio recebido';
                messageType = 'audio';
            }
            else if (message.video) {
                messageText = message.video.caption || 'Vídeo recebido';
                messageType = 'video';
            }
            else {
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
                sender: 'user',
                type: messageType,
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
                        displayPhoneNumber: metadata === null || metadata === void 0 ? void 0 : metadata.display_phone_number,
                        phoneNumberId: metadata === null || metadata === void 0 ? void 0 : metadata.phone_number_id
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            else {
                // Atualizar conversa existente
                await conversationRef.update({
                    messages: admin.firestore.FieldValue.arrayUnion(messageData),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'active' // Reativar conversa se estava resolvida
                });
            }
            // Processar com Dialogflow apenas para mensagens de texto
            if (messageType === 'text' && messageText.trim()) {
                const dialogflowService = new shared_1.DialogflowService(dialogflowConfig);
                try {
                    const dialogflowResponse = await dialogflowService.detectIntent(sessionId, messageText);
                    console.log('🤖 Resposta do Dialogflow:', dialogflowResponse);
                    // Salvar resposta do bot na conversa
                    const botMessageData = {
                        id: `bot-${Date.now()}`,
                        conversationId: sessionId,
                        content: dialogflowResponse.text,
                        sender: 'bot',
                        type: 'text',
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
                }
                catch (dialogflowError) {
                    console.error('❌ Erro no Dialogflow:', dialogflowError);
                    // Enviar mensagem de erro amigável
                    await sendWhatsAppMessage(from, 'Desculpe, estou com algumas dificuldades técnicas no momento. ' +
                        'Tente novamente em alguns instantes ou entre em contato pelo telefone (11) 9999-9999.');
                }
            }
            else if (messageType !== 'text') {
                // Resposta para tipos de mídia não suportados
                await sendWhatsAppMessage(from, 'Recebi sua mensagem! No momento, posso processar apenas mensagens de texto. ' +
                    'Como posso ajudar você?');
            }
            res.sendStatus(200);
        }
        catch (error) {
            console.error('❌ Erro no webhook WhatsApp:', error);
            res.sendStatus(500);
        }
    });
}
async function sendWhatsAppMessage(to, text) {
    var _a;
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
        console.error('❌ Configurações do WhatsApp não encontradas');
        return;
    }
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`;
    try {
        const response = await axios_1.default.post(url, {
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
    }
    catch (error) {
        console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
        if (axios_1.default.isAxiosError(error)) {
            console.error('Resposta da API:', (_a = error.response) === null || _a === void 0 ? void 0 : _a.data);
        }
    }
}
// Função auxiliar para download de mídia (futuro)
async function downloadWhatsAppMedia(mediaId) {
    if (!WHATSAPP_TOKEN) {
        return null;
    }
    try {
        // Primeiro, obter URL da mídia
        const mediaInfoResponse = await axios_1.default.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            }
        });
        const mediaUrl = mediaInfoResponse.data.url;
        // Fazer download da mídia
        const mediaResponse = await axios_1.default.get(mediaUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            }
        });
        return Buffer.from(mediaResponse.data);
    }
    catch (error) {
        console.error('❌ Erro ao baixar mídia:', error);
        return null;
    }
}
//# sourceMappingURL=whatsapp.js.map