import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Campaign, Template, Lead, User } from '../../../shared/src/types/core';
import axios from 'axios';

const db = admin.firestore();

// ========== CONFIGURAÇÕES DE EMAIL ==========

interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'ses';
  apiKey: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  domain?: string;
  region?: string;
}

// ========== CLOUD FUNCTIONS PARA EMAIL ==========

/**
 * Criar campanha de email
 */
export const createEmailCampaign = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    name: string;
    description?: string;
    subject: string;
    content: string;
    templateId?: string;
    targeting: {
      leadIds?: string[];
      filters?: any[];
      tags?: string[];
      excludeTags?: string[];
    };
    scheduledAt?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para criar campanhas');
    }
    
    // Verificar limites da organização
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    const org = orgDoc.data();
    
    if (org?.usage?.campaigns >= org?.limits?.campaigns) {
      throw new functions.https.HttpsError('resource-exhausted', 'Limite de campanhas atingido');
    }
    
    const campaignData: Partial<Campaign> = {
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
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
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
    
    return {
      id: campaignRef.id,
      ...campaignData,
    };
  }
);

/**
 * Enviar campanha de email
 */
export const sendEmailCampaign = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    campaignId: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
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
    
    const campaign = campaignDoc.data() as Campaign;
    
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
  }
);

/**
 * Executar campanha de email
 */
async function executeCampaign(organizationId: string, campaignId: string) {
  try {
    const campaignDoc = await db.collection('organizations')
      .doc(organizationId)
      .collection('campaigns')
      .doc(campaignId)
      .get();
    
    const campaign = campaignDoc.data() as Campaign;
    
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
          
        } catch (error) {
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
    
  } catch (error) {
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
async function getLeadsForCampaign(organizationId: string, targeting: any): Promise<Lead[]> {
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
      leads.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    }
    
    return leads.filter(lead => lead.email); // Apenas leads com email
  }
  
  // Filtros por tags
  if (targeting.tags && targeting.tags.length > 0) {
    query = query.where('tags', 'array-contains-any', targeting.tags);
  }
  
  // Buscar todos os leads que atendem aos critérios
  const snapshot = await query.get();
  let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
  
  // Filtrar leads com email
  leads = leads.filter(lead => lead.email);
  
  // Excluir tags se especificado
  if (targeting.excludeTags && targeting.excludeTags.length > 0) {
    leads = leads.filter(lead => 
      !targeting.excludeTags.some(tag => lead.tags.includes(tag))
    );
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
async function getEmailConfig(organizationId: string): Promise<EmailConfig> {
  const configDoc = await db.collection('organizations')
    .doc(organizationId)
    .collection('settings')
    .doc('email')
    .get();
  
  if (!configDoc.exists) {
    throw new Error('Configuração de email não encontrada');
  }
  
  return configDoc.data() as EmailConfig;
}

/**
 * Enviar email para lead
 */
async function sendEmailToLead(config: EmailConfig, campaign: Campaign, lead: Lead) {
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
async function sendViaSendGrid(config: EmailConfig, emailData: any) {
  const response = await axios.post('https://api.sendgrid.com/v3/mail/send', {
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
async function sendViaMailgun(config: EmailConfig, emailData: any) {
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
    formData.append(`v:${key}`, value as string);
  });
  
  const response = await axios.post(url, formData, {
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
async function sendViaSES(config: EmailConfig, emailData: any) {
  // Implementação simplificada - em produção usaria AWS SDK
  throw new Error('Amazon SES não implementado ainda');
}

/**
 * Personalizar conteúdo com dados do lead
 */
function personalizeContent(content: string, lead: Lead): string {
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
async function recordEmailInteraction(
  organizationId: string,
  leadId: string,
  campaign: Campaign,
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'
) {
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
export const emailWebhook = functions.https.onRequest(async (req, res) => {
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
  } catch (error) {
    console.error('Erro no webhook de email:', error);
    res.status(500).send('Erro interno');
  }
});

/**
 * Processar evento de email
 */
async function processEmailEvent(event: any) {
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
    
    const updateData: any = {
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
      await recordEmailInteraction(organizationId, leadId, { id: campaignId } as Campaign, eventType);
    }
    
  } catch (error) {
    console.error('Erro ao processar evento de email:', error);
  }
}

/**
 * Criar template de email
 */
export const createEmailTemplate = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    name: string;
    description?: string;
    subject: string;
    body: string;
    category?: string;
    variables?: any[];
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para criar templates');
    }
    
    const templateData: Partial<Template> = {
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
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      createdBy: auth.uid,
    };
    
    const templateRef = await db.collection('organizations')
      .doc(user.organizationId)
      .collection('templates')
      .add(templateData);
    
    return {
      id: templateRef.id,
      ...templateData,
    };
  }
);

/**
 * Listar templates de email
 */
export const listEmailTemplates = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    category?: string;
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
    
    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return {
      templates,
      pagination: {
        page,
        limit,
        total: snapshot.size,
        hasMore: snapshot.size === limit,
      },
    };
  }
);

// ========== FUNÇÕES AUXILIARES ==========

async function scheduleEmailCampaign(campaignId: string, scheduledDate: Date) {
  // Em produção, usaria Cloud Scheduler ou similar
  // Por simplicidade, apenas logando
  console.log(`Campanha ${campaignId} agendada para ${scheduledDate.toISOString()}`);
}

async function updateOrganizationUsage(organizationId: string, updates: any) {
  await db.collection('organizations').doc(organizationId).update({
    [`usage.${Object.keys(updates)[0]}`]: admin.firestore.FieldValue.increment(Object.values(updates)[0] as number),
    'usage.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
  });
}

