import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Lead, LeadInteraction, User, LeadStatus, LeadSource, InteractionType } from '../../../shared/src/types/core';

const db = admin.firestore();

// ========== CLOUD FUNCTIONS PARA LEADS ==========

/**
 * Criar novo lead
 */
export const createLead = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    name: string;
    email?: string;
    phone?: string;
    whatsappPhone?: string;
    company?: string;
    position?: string;
    source: LeadSource;
    sourceDetails?: any;
    assignedTo?: string;
    tags?: string[];
    customFields?: Record<string, any>;
    notes?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager', 'agent'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para criar leads');
    }
    
    // Verificar se já existe lead com mesmo email ou telefone
    if (data.email || data.phone) {
      const existingLeadQuery = db.collection('organizations')
        .doc(user.organizationId)
        .collection('leads');
      
      let query = existingLeadQuery.where('organizationId', '==', user.organizationId);
      
      if (data.email) {
        const emailCheck = await query.where('email', '==', data.email).get();
        if (!emailCheck.empty) {
          throw new functions.https.HttpsError('already-exists', 'Já existe um lead com este email');
        }
      }
      
      if (data.phone) {
        const phoneCheck = await query.where('phone', '==', data.phone).get();
        if (!phoneCheck.empty) {
          throw new functions.https.HttpsError('already-exists', 'Já existe um lead com este telefone');
        }
      }
    }
    
    // Calcular score inicial do lead
    const initialScore = calculateLeadScore({
      email: data.email,
      phone: data.phone,
      company: data.company,
      position: data.position,
      source: data.source,
    });
    
    const leadData: Partial<Lead> = {
      organizationId: user.organizationId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      whatsappPhone: data.whatsappPhone || data.phone,
      company: data.company,
      position: data.position,
      source: data.source,
      sourceDetails: data.sourceDetails,
      status: 'new',
      assignedTo: data.assignedTo,
      score: initialScore,
      temperature: getTemperatureFromScore(initialScore),
      tags: data.tags || [],
      customFields: data.customFields || {},
      notes: data.notes,
      interactionCount: 0,
      isArchived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      createdBy: auth.uid,
    };
    
    const leadRef = await db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .add(leadData);
    
    // Criar interação inicial (sistema)
    await createInteraction(user.organizationId, leadRef.id, {
      type: 'system',
      content: {
        body: `Lead criado por ${user.displayName}`,
      },
      userId: auth.uid,
    });
    
    // Atualizar contagem de leads da organização
    await updateOrganizationUsage(user.organizationId, { leads: 1 });
    
    // Disparar automações
    await triggerAutomations(user.organizationId, 'lead_created', {
      leadId: leadRef.id,
      lead: { id: leadRef.id, ...leadData },
    });
    
    return {
      id: leadRef.id,
      ...leadData,
    };
  }
);

/**
 * Atualizar lead
 */
export const updateLead = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    leadId: string;
    updates: Partial<Lead>;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    const leadRef = db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .doc(data.leadId);
    
    const leadDoc = await leadRef.get();
    
    if (!leadDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Lead não encontrado');
    }
    
    const lead = leadDoc.data() as Lead;
    
    // Verificar permissões
    if (!['admin', 'manager'].includes(user.role) && 
        user.role === 'agent' && lead.assignedTo !== auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para editar este lead');
    }
    
    const previousStatus = lead.status;
    const updates = {
      ...data.updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.uid,
    };
    
    // Se mudou o status, atualizar campos relacionados
    if (data.updates.status && data.updates.status !== previousStatus) {
      updates.previousStatus = previousStatus;
      
      if (data.updates.status === 'qualified' && !lead.qualifiedAt) {
        updates.qualifiedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      
      if (['won', 'lost'].includes(data.updates.status) && !lead.actualCloseDate) {
        updates.actualCloseDate = admin.firestore.FieldValue.serverTimestamp();
        
        if (data.updates.status === 'won') {
          updates.convertedAt = admin.firestore.FieldValue.serverTimestamp();
        }
      }
    }
    
    // Recalcular score se necessário
    if (data.updates.email || data.updates.phone || data.updates.company || 
        data.updates.position || data.updates.source) {
      const updatedLead = { ...lead, ...data.updates };
      updates.score = calculateLeadScore(updatedLead);
      updates.temperature = getTemperatureFromScore(updates.score);
    }
    
    await leadRef.update(updates);
    
    // Criar interação de atualização
    const changeDescription = generateChangeDescription(lead, data.updates, user.displayName);
    if (changeDescription) {
      await createInteraction(user.organizationId, data.leadId, {
        type: 'system',
        content: {
          body: changeDescription,
        },
        userId: auth.uid,
      });
    }
    
    // Disparar automações se mudou status
    if (data.updates.status && data.updates.status !== previousStatus) {
      await triggerAutomations(user.organizationId, 'lead_status_changed', {
        leadId: data.leadId,
        lead: { ...lead, ...updates },
        previousStatus,
        newStatus: data.updates.status,
      });
    }
    
    return { success: true };
  }
);

/**
 * Obter lead
 */
export const getLead = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    leadId: string;
    includeInteractions?: boolean;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    const leadDoc = await db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .doc(data.leadId)
      .get();
    
    if (!leadDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Lead não encontrado');
    }
    
    const lead = {
      id: leadDoc.id,
      ...leadDoc.data(),
    };
    
    let interactions = [];
    
    if (data.includeInteractions) {
      const interactionsSnapshot = await db.collection('organizations')
        .doc(user.organizationId)
        .collection('leads')
        .doc(data.leadId)
        .collection('interactions')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      interactions = interactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    
    return {
      lead,
      interactions,
    };
  }
);

/**
 * Listar leads
 */
export const listLeads = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    page?: number;
    limit?: number;
    status?: LeadStatus;
    source?: LeadSource;
    assignedTo?: string;
    tags?: string[];
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    const page = data.page || 1;
    const limit = Math.min(data.limit || 20, 100); // Máximo 100 por página
    const offset = (page - 1) * limit;
    
    let query = db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .where('isArchived', '==', false);
    
    // Filtros
    if (data.status) {
      query = query.where('status', '==', data.status);
    }
    
    if (data.source) {
      query = query.where('source', '==', data.source);
    }
    
    if (data.assignedTo) {
      query = query.where('assignedTo', '==', data.assignedTo);
    }
    
    if (data.tags && data.tags.length > 0) {
      query = query.where('tags', 'array-contains-any', data.tags);
    }
    
    if (data.dateFrom) {
      query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(data.dateFrom)));
    }
    
    if (data.dateTo) {
      query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(data.dateTo)));
    }
    
    // Ordenação
    const orderBy = data.orderBy || 'createdAt';
    const orderDirection = data.orderDirection || 'desc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Paginação
    query = query.limit(limit).offset(offset);
    
    const snapshot = await query.get();
    
    let leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Filtro de busca (feito em memória para simplicidade)
    if (data.search) {
      const searchTerm = data.search.toLowerCase();
      leads = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
        (lead.phone && lead.phone.includes(searchTerm)) ||
        (lead.company && lead.company.toLowerCase().includes(searchTerm))
      );
    }
    
    // Contar total (aproximado)
    const totalSnapshot = await db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .where('isArchived', '==', false)
      .get();
    
    const total = totalSnapshot.size;
    
    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    };
  }
);

/**
 * Deletar lead
 */
export const deleteLead = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    leadId: string;
    permanent?: boolean;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para deletar leads');
    }
    
    const leadRef = db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .doc(data.leadId);
    
    if (data.permanent) {
      // Deletar permanentemente
      await leadRef.delete();
      
      // Deletar todas as interações
      const interactionsSnapshot = await leadRef.collection('interactions').get();
      const batch = db.batch();
      interactionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
    } else {
      // Arquivar
      await leadRef.update({
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedBy: auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    
    return { success: true };
  }
);

/**
 * Adicionar interação ao lead
 */
export const addLeadInteraction = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    leadId: string;
    type: InteractionType;
    direction?: 'inbound' | 'outbound';
    content: {
      subject?: string;
      body?: string;
      attachments?: any[];
      duration?: number;
      outcome?: string;
      nextAction?: string;
    };
    metadata?: any;
    scheduledAt?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager', 'agent'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para adicionar interações');
    }
    
    const leadRef = db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .doc(data.leadId);
    
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Lead não encontrado');
    }
    
    const interaction = await createInteraction(user.organizationId, data.leadId, {
      type: data.type,
      direction: data.direction,
      content: data.content,
      metadata: data.metadata,
      userId: auth.uid,
      scheduledAt: data.scheduledAt ? admin.firestore.Timestamp.fromDate(new Date(data.scheduledAt)) : undefined,
    });
    
    // Atualizar lead
    await leadRef.update({
      interactionCount: admin.firestore.FieldValue.increment(1),
      lastContactAt: admin.firestore.FieldValue.serverTimestamp(),
      lastInteractionType: data.type,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Disparar automações
    await triggerAutomations(user.organizationId, 'interaction_added', {
      leadId: data.leadId,
      interaction,
    });
    
    return interaction;
  }
);

/**
 * Atribuir lead a usuário
 */
export const assignLead = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    leadId: string;
    userId: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (!['admin', 'manager'].includes(user.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para atribuir leads');
    }
    
    // Verificar se o usuário de destino existe na organização
    const targetUserDoc = await db.collection('organizations')
      .doc(user.organizationId)
      .collection('users')
      .doc(data.userId)
      .get();
    
    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Usuário não encontrado na organização');
    }
    
    const targetUser = targetUserDoc.data() as User;
    
    await db.collection('organizations')
      .doc(user.organizationId)
      .collection('leads')
      .doc(data.leadId)
      .update({
        assignedTo: data.userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
      });
    
    // Criar interação de atribuição
    await createInteraction(user.organizationId, data.leadId, {
      type: 'system',
      content: {
        body: `Lead atribuído para ${targetUser.displayName} por ${user.displayName}`,
      },
      userId: auth.uid,
    });
    
    return { success: true };
  }
);

// ========== FUNÇÕES AUXILIARES ==========

async function createInteraction(
  organizationId: string, 
  leadId: string, 
  interactionData: Partial<LeadInteraction>
): Promise<LeadInteraction> {
  const interaction: Partial<LeadInteraction> = {
    organizationId,
    leadId,
    isRead: false,
    isImportant: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
    ...interactionData,
  };
  
  const interactionRef = await db.collection('organizations')
    .doc(organizationId)
    .collection('leads')
    .doc(leadId)
    .collection('interactions')
    .add(interaction);
  
  return {
    id: interactionRef.id,
    ...interaction,
  } as LeadInteraction;
}

function calculateLeadScore(lead: Partial<Lead>): number {
  let score = 0;
  
  // Email válido (+20)
  if (lead.email && lead.email.includes('@')) {
    score += 20;
  }
  
  // Telefone (+15)
  if (lead.phone) {
    score += 15;
  }
  
  // Empresa (+25)
  if (lead.company) {
    score += 25;
  }
  
  // Posição/cargo (+20)
  if (lead.position) {
    score += 20;
  }
  
  // Fonte do lead
  const sourceScores = {
    website: 15,
    whatsapp: 20,
    facebook: 10,
    instagram: 10,
    google: 15,
    linkedin: 25,
    email: 20,
    phone: 25,
    referral: 30,
    manual: 5,
    api: 10,
  };
  
  score += sourceScores[lead.source] || 0;
  
  return Math.min(score, 100); // Máximo 100
}

function getTemperatureFromScore(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function generateChangeDescription(
  oldLead: Lead, 
  updates: Partial<Lead>, 
  userName: string
): string {
  const changes = [];
  
  if (updates.status && updates.status !== oldLead.status) {
    changes.push(`status de "${oldLead.status}" para "${updates.status}"`);
  }
  
  if (updates.assignedTo && updates.assignedTo !== oldLead.assignedTo) {
    changes.push(`responsável alterado`);
  }
  
  if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(oldLead.tags)) {
    changes.push(`tags atualizadas`);
  }
  
  if (updates.estimatedValue && updates.estimatedValue !== oldLead.estimatedValue) {
    changes.push(`valor estimado alterado`);
  }
  
  if (changes.length === 0) return '';
  
  return `${userName} alterou: ${changes.join(', ')}`;
}

async function triggerAutomations(
  organizationId: string, 
  trigger: string, 
  data: any
): Promise<void> {
  // Buscar automações ativas para este trigger
  const automationsSnapshot = await db.collection('organizations')
    .doc(organizationId)
    .collection('automations')
    .where('isActive', '==', true)
    .where('trigger.type', '==', trigger)
    .get();
  
  // Executar cada automação (em background)
  for (const automationDoc of automationsSnapshot.docs) {
    const automation = automationDoc.data();
    
    // Verificar condições
    const conditionsMet = await evaluateAutomationConditions(automation.trigger.conditions, data);
    
    if (conditionsMet) {
      // Executar ações da automação
      await executeAutomationActions(organizationId, automation.actions, data);
      
      // Atualizar métricas da automação
      await automationDoc.ref.update({
        'metrics.triggered': admin.firestore.FieldValue.increment(1),
        'metrics.lastExecution': admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

async function evaluateAutomationConditions(conditions: any[], data: any): Promise<boolean> {
  // Implementação simplificada - avaliar condições
  // Em uma implementação real, seria mais complexa
  return true;
}

async function executeAutomationActions(
  organizationId: string, 
  actions: any[], 
  data: any
): Promise<void> {
  // Implementação simplificada - executar ações
  // Em uma implementação real, executaria cada tipo de ação
  for (const action of actions) {
    switch (action.type) {
      case 'send_email':
        // Enviar email
        break;
      case 'send_whatsapp':
        // Enviar WhatsApp
        break;
      case 'create_task':
        // Criar tarefa
        break;
      case 'update_lead':
        // Atualizar lead
        break;
      case 'add_tag':
        // Adicionar tag
        break;
      case 'remove_tag':
        // Remover tag
        break;
      case 'assign_user':
        // Atribuir usuário
        break;
      case 'webhook':
        // Chamar webhook
        break;
    }
  }
}

async function updateOrganizationUsage(organizationId: string, updates: any): Promise<void> {
  await db.collection('organizations').doc(organizationId).update({
    [`usage.${Object.keys(updates)[0]}`]: admin.firestore.FieldValue.increment(Object.values(updates)[0] as number),
    'usage.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
  });
}

