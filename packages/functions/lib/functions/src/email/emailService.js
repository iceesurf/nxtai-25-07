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
exports.listEmailTemplates = exports.createEmailTemplate = exports.emailWebhook = exports.sendEmailCampaign = exports.createEmailCampaign = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const db = admin.firestore();
// ========== CLOUD FUNCTIONS PARA EMAIL ==========
/**
 * Criar campanha de email
 */
exports.createEmailCampaign = functions.https.onCall(async (request) => {
    var _a, _b;
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para criar campanhas');
    }
    // Verificar limites da organização
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    const org = orgDoc.data();
    if (((_a = org === null || org === void 0 ? void 0 : org.usage) === null || _a === void 0 ? void 0 : _a.campaigns) >= ((_b = org === null || org === void 0 ? void 0 : org.limits) === null || _b === void 0 ? void 0 : _b.campaigns)) {
        throw new functions.https.HttpsError('resource-exhausted', 'Limite de campanhas atingido');
    }
    const campaignData = {
        organizationId: user.organizationId,
        name: data.name,
        description: data.description,
        type: 'email',
        status: data.scheduledAt ? 'scheduled' : 'draft',
        settings: {
            subject: data.subject,
            content: data.content,
            template: data.templateId,
            sendTime: data.scheduledAt ? admin.firestore.Timestamp.fromDate(new Date(data.scheduledAt)) : undefined,
            timezone: 'America/Sao_Paulo',
            frequency: 'once',
        },
        targeting: data.targeting,
        metrics: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            bounced: 0,
            unsubscribed: 0,
            converted: 0,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledAt: data.scheduledAt ? admin.firestore.Timestamp.fromDate(new Date(data.scheduledAt)) : undefined,
        createdBy: auth.uid,
    };
    const campaignRef = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('campaigns')
        .add(campaignData);
    // Atualizar contagem de campanhas
    await updateOrganizationUsage(user.organizationId, { campaigns: 1 });
    // Se agendada, criar job para envio
    if (data.scheduledAt) {
        await scheduleEmailCampaign(campaignRef.id, new Date(data.scheduledAt));
    }
    return Object.assign({ id: campaignRef.id }, campaignData);
});
/**
 * Enviar campanha de email
 */
exports.sendEmailCampaign = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para enviar campanhas');
    }
    const campaignDoc = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('campaigns')
        .doc(data.campaignId)
        .get();
    if (!campaignDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Campanha não encontrada');
    }
    const campaign = campaignDoc.data();
    if (campaign.status === 'running') {
        throw new functions.https.HttpsError('failed-precondition', 'Campanha já está sendo executada');
    }
    if (campaign.status === 'completed') {
        throw new functions.https.HttpsError('failed-precondition', 'Campanha já foi executada');
    }
    // Atualizar status para running
    await campaignDoc.ref.update({
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Executar campanha em background
    await executeCampaign(user.organizationId, data.campaignId);
    return { success: true };
});
/**
 * Executar campanha de email
 */
async function executeCampaign(organizationId, campaignId) {
    try {
        const campaignDoc = await db.collection('organizations')
            .doc(organizationId)
            .collection('campaigns')
            .doc(campaignId)
            .get();
        const campaign = campaignDoc.data();
        // Buscar leads para a campanha
        const leads = await getLeadsForCampaign(organizationId, campaign.targeting);
        // Buscar configuração de email
        const emailConfig = await getEmailConfig(organizationId);
        let sent = 0;
        let failed = 0;
        // Enviar emails em lotes
        const batchSize = 50;
        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);
            const promises = batch.map(async (lead) => {
                try {
                    await sendEmailToLead(emailConfig, campaign, lead);
                    sent++;
                    // Registrar interação
                    await recordEmailInteraction(organizationId, lead.id, campaign, 'sent');
                }
                catch (error) {
                    console.error(`Erro ao enviar email para ${lead.email}:`, error);
                    failed++;
                }
            });
            await Promise.all(promises);
            // Atualizar métricas da campanha
            await campaignDoc.ref.update({
                'metrics.sent': sent,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Aguardar um pouco entre lotes para não sobrecarregar
            if (i + batchSize < leads.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        // Finalizar campanha
        await campaignDoc.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            'metrics.sent': sent,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Campanha ${campaignId} finalizada: ${sent} enviados, ${failed} falharam`);
    }
    catch (error) {
        console.error(`Erro ao executar campanha ${campaignId}:`, error);
        // Marcar campanha como falhou
        await db.collection('organizations')
            .doc(organizationId)
            .collection('campaigns')
            .doc(campaignId)
            .update({
            status: 'cancelled',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
}
/**
 * Buscar leads para campanha
 */
async function getLeadsForCampaign(organizationId, targeting) {
    let query = db.collection('organizations')
        .doc(organizationId)
        .collection('leads')
        .where('isArchived', '==', false);
    // Se especificou leads específicos
    if (targeting.leadIds && targeting.leadIds.length > 0) {
        // Firestore tem limite de 10 itens no 'in', então fazemos múltiplas consultas
        const leadIds = targeting.leadIds;
        const chunks = [];
        for (let i = 0; i < leadIds.length; i += 10) {
            chunks.push(leadIds.slice(i, i + 10));
        }
        const leads = [];
        for (const chunk of chunks) {
            const snapshot = await query.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            leads.push(...snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))));
        }
        return leads.filter(lead => lead.email); // Apenas leads com email
    }
    // Filtros por tags
    if (targeting.tags && targeting.tags.length > 0) {
        query = query.where('tags', 'array-contains-any', targeting.tags);
    }
    // Buscar todos os leads que atendem aos critérios
    const snapshot = await query.get();
    let leads = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Filtrar leads com email
    leads = leads.filter(lead => lead.email);
    // Excluir tags se especificado
    if (targeting.excludeTags && targeting.excludeTags.length > 0) {
        leads = leads.filter(lead => !targeting.excludeTags.some(tag => lead.tags.includes(tag)));
    }
    // Aplicar filtros adicionais (implementação simplificada)
    if (targeting.filters && targeting.filters.length > 0) {
        leads = leads.filter(lead => {
            return targeting.filters.every(filter => {
                const fieldValue = lead[filter.field];
                switch (filter.operator) {
                    case 'equals':
                        return fieldValue === filter.value;
                    case 'not_equals':
                        return fieldValue !== filter.value;
                    case 'contains':
                        return fieldValue && fieldValue.toString().toLowerCase().includes(filter.value.toLowerCase());
                    case 'not_contains':
                        return !fieldValue || !fieldValue.toString().toLowerCase().includes(filter.value.toLowerCase());
                    case 'in':
                        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
                    case 'not_in':
                        return !Array.isArray(filter.value) || !filter.value.includes(fieldValue);
                    default:
                        return true;
                }
            });
        });
    }
    return leads;
}
/**
 * Buscar configuração de email
 */
async function getEmailConfig(organizationId) {
    const configDoc = await db.collection('organizations')
        .doc(organizationId)
        .collection('settings')
        .doc('email')
        .get();
    if (!configDoc.exists) {
        throw new Error('Configuração de email não encontrada');
    }
    return configDoc.data();
}
/**
 * Enviar email para lead
 */
async function sendEmailToLead(config, campaign, lead) {
    // Personalizar conteúdo
    const personalizedSubject = personalizeContent(campaign.settings.subject, lead);
    const personalizedContent = personalizeContent(campaign.settings.content, lead);
    const emailData = {
        to: lead.email,
        from: {
            email: config.fromEmail,
            name: config.fromName,
        },
        replyTo: config.replyTo || config.fromEmail,
        subject: personalizedSubject,
        html: personalizedContent,
        // Adicionar headers para tracking
        customArgs: {
            campaignId: campaign.id,
            leadId: lead.id,
            organizationId: campaign.organizationId,
        },
    };
    switch (config.provider) {
        case 'sendgrid':
            return await sendViaSendGrid(config, emailData);
        case 'mailgun':
            return await sendViaMailgun(config, emailData);
        case 'ses':
            return await sendViaSES(config, emailData);
        default:
            throw new Error('Provedor de email não configurado');
    }
}
/**
 * Enviar via SendGrid
 */
async function sendViaSendGrid(config, emailData) {
    const response = await axios_1.default.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [{
                to: [{ email: emailData.to }],
                subject: emailData.subject,
                custom_args: emailData.customArgs,
            }],
        from: emailData.from,
        reply_to: { email: emailData.replyTo },
        content: [{
                type: 'text/html',
                value: emailData.html,
            }],
        tracking_settings: {
            click_tracking: { enable: true },
            open_tracking: { enable: true },
        },
    }, {
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
}
/**
 * Enviar via Mailgun
 */
async function sendViaMailgun(config, emailData) {
    const domain = config.domain;
    const url = `https://api.mailgun.net/v3/${domain}/messages`;
    const formData = new FormData();
    formData.append('from', `${emailData.from.name} <${emailData.from.email}>`);
    formData.append('to', emailData.to);
    formData.append('subject', emailData.subject);
    formData.append('html', emailData.html);
    formData.append('h:Reply-To', emailData.replyTo);
    // Adicionar custom args
    Object.entries(emailData.customArgs).forEach(([key, value]) => {
        formData.append(`v:${key}`, value);
    });
    const response = await axios_1.default.post(url, formData, {
        auth: {
            username: 'api',
            password: config.apiKey,
        },
    });
    return response.data;
}
/**
 * Enviar via Amazon SES
 */
async function sendViaSES(config, emailData) {
    // Implementação simplificada - em produção usaria AWS SDK
    throw new Error('Amazon SES não implementado ainda');
}
/**
 * Personalizar conteúdo com dados do lead
 */
function personalizeContent(content, lead) {
    let personalized = content;
    // Substituir variáveis
    const variables = {
        '{{nome}}': lead.name,
        '{{email}}': lead.email || '',
        '{{telefone}}': lead.phone || '',
        '{{empresa}}': lead.company || '',
        '{{cargo}}': lead.position || '',
        '{{primeiro_nome}}': lead.name.split(' ')[0],
    };
    Object.entries(variables).forEach(([variable, value]) => {
        personalized = personalized.replace(new RegExp(variable, 'g'), value);
    });
    return personalized;
}
/**
 * Registrar interação de email
 */
async function recordEmailInteraction(organizationId, leadId, campaign, type) {
    await db.collection('organizations')
        .doc(organizationId)
        .collection('leads')
        .doc(leadId)
        .collection('interactions')
        .add({
        organizationId,
        leadId,
        type: 'email',
        direction: 'outbound',
        content: {
            subject: campaign.settings.subject,
            body: `Email da campanha: ${campaign.name}`,
        },
        metadata: {
            campaignId: campaign.id,
            emailType: type,
        },
        isRead: false,
        isImportant: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
/**
 * Webhook para eventos de email (SendGrid, Mailgun, etc.)
 */
exports.emailWebhook = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Método não permitido');
            return;
        }
        const events = req.body;
        for (const event of events) {
            await processEmailEvent(event);
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Erro no webhook de email:', error);
        res.status(500).send('Erro interno');
    }
});
/**
 * Processar evento de email
 */
async function processEmailEvent(event) {
    try {
        const { campaignId, leadId, organizationId } = event.customArgs || event.variables || {};
        if (!campaignId || !leadId || !organizationId) {
            console.log('Evento de email sem dados de rastreamento');
            return;
        }
        const eventType = event.event || event.type;
        // Atualizar métricas da campanha
        const campaignRef = db.collection('organizations')
            .doc(organizationId)
            .collection('campaigns')
            .doc(campaignId);
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        switch (eventType) {
            case 'delivered':
                updateData['metrics.delivered'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'open':
            case 'opened':
                updateData['metrics.opened'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'click':
            case 'clicked':
                updateData['metrics.clicked'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'bounce':
            case 'bounced':
                updateData['metrics.bounced'] = admin.firestore.FieldValue.increment(1);
                break;
            case 'unsubscribe':
            case 'unsubscribed':
                updateData['metrics.unsubscribed'] = admin.firestore.FieldValue.increment(1);
                break;
        }
        await campaignRef.update(updateData);
        // Registrar interação no lead
        if (['delivered', 'opened', 'clicked', 'bounced'].includes(eventType)) {
            await recordEmailInteraction(organizationId, leadId, { id: campaignId }, eventType);
        }
    }
    catch (error) {
        console.error('Erro ao processar evento de email:', error);
    }
}
/**
 * Criar template de email
 */
exports.createEmailTemplate = functions.https.onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data();
    if (!['admin', 'manager'].includes(user.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão para criar templates');
    }
    const templateData = {
        organizationId: user.organizationId,
        name: data.name,
        description: data.description,
        type: 'email',
        category: data.category,
        content: {
            subject: data.subject,
            body: data.body,
            variables: data.variables || [],
        },
        isActive: true,
        isDefault: false,
        usageCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid,
    };
    const templateRef = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('templates')
        .add(templateData);
    return Object.assign({ id: templateRef.id }, templateData);
});
/**
 * Listar templates de email
 */
exports.listEmailTemplates = functions.https.onCall(async (request) => {
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
        .collection('templates')
        .where('type', '==', 'email')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc');
    if (data.category) {
        query = query.where('category', '==', data.category);
    }
    const snapshot = await query.limit(limit).offset(offset).get();
    const templates = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    return {
        templates,
        pagination: {
            page,
            limit,
            total: snapshot.size,
            hasMore: snapshot.size === limit,
        },
    };
});
// ========== FUNÇÕES AUXILIARES ==========
async function scheduleEmailCampaign(campaignId, scheduledDate) {
    // Em produção, usaria Cloud Scheduler ou similar
    // Por simplicidade, apenas logando
    console.log(`Campanha ${campaignId} agendada para ${scheduledDate.toISOString()}`);
}
async function updateOrganizationUsage(organizationId, updates) {
    await db.collection('organizations').doc(organizationId).update({
        [`usage.${Object.keys(updates)[0]}`]: admin.firestore.FieldValue.increment(Object.values(updates)[0]),
        'usage.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=emailService.js.map