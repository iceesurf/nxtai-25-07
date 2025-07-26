import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Organization, User, PlanType, OrganizationStatus } from '../../../shared/src/types/core';

const db = admin.firestore();

// ========== CLOUD FUNCTIONS PARA ORGANIZAÇÕES ==========

/**
 * Criar nova organização (apenas superadmin)
 */
export const createOrganization = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    name: string;
    subdomain: string;
    plan: PlanType;
    adminEmail: string;
    adminName: string;
    domain?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    // Verificar se é superadmin
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (user.role !== 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas superadmins podem criar organizações');
    }
    
    // Verificar se o subdomínio já existe
    const existingOrg = await db.collection('organizations')
      .where('subdomain', '==', data.subdomain)
      .get();
    
    if (!existingOrg.empty) {
      throw new functions.https.HttpsError('already-exists', 'Subdomínio já está em uso');
    }
    
    // Definir limites baseados no plano
    const planLimits = getPlanLimits(data.plan);
    
    // Criar organização
    const orgData: Partial<Organization> = {
      name: data.name,
      subdomain: data.subdomain,
      domain: data.domain,
      plan: data.plan,
      status: 'trial' as OrganizationStatus,
      whitelabel: {
        companyName: data.name,
        primaryColor: '#3B82F6',
        secondaryColor: '#1F2937',
        accentColor: '#10B981',
      },
      settings: {
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        language: 'pt-BR',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        features: planLimits.features,
        customFields: [],
      },
      limits: planLimits.limits,
      usage: {
        users: 0,
        leads: 0,
        storage: 0,
        apiCalls: 0,
        campaigns: 0,
        automations: 0,
        integrations: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp() as any,
      },
      billing: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      trialEndsAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      ),
    };
    
    const orgRef = await db.collection('organizations').add(orgData);
    const orgId = orgRef.id;
    
    // Criar usuário admin da organização
    try {
      const adminUser = await admin.auth().createUser({
        email: data.adminEmail,
        displayName: data.adminName,
        emailVerified: false,
      });
      
      // Criar documento do usuário
      const userData: Partial<User> = {
        id: adminUser.uid,
        email: data.adminEmail,
        displayName: data.adminName,
        organizationId: orgId,
        role: 'admin',
        permissions: getDefaultPermissions('admin'),
        status: 'active',
        isEmailVerified: false,
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          notifications: {
            email: true,
            push: true,
            sms: false,
            leadAssigned: true,
            leadStatusChanged: true,
            newMessage: true,
            taskDue: true,
            campaignCompleted: true,
          },
          dashboard: {
            widgets: getDefaultDashboardWidgets(),
            layout: 'grid',
            refreshInterval: 300000, // 5 minutos
          },
        },
        loginCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };
      
      await db.collection('users').doc(adminUser.uid).set(userData);
      await db.collection('organizations').doc(orgId).collection('users').doc(adminUser.uid).set(userData);
      
      // Atualizar contagem de usuários
      await updateOrganizationUsage(orgId, { users: 1 });
      
      // Criar configurações padrão
      await createDefaultSettings(orgId);
      
      return {
        organizationId: orgId,
        adminUserId: adminUser.uid,
        organization: { id: orgId, ...orgData },
      };
      
    } catch (error) {
      // Rollback: deletar organização se falhou ao criar usuário
      await db.collection('organizations').doc(orgId).delete();
      throw new functions.https.HttpsError('internal', 'Erro ao criar usuário admin');
    }
  }
);

/**
 * Atualizar organização
 */
export const updateOrganization = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    organizationId: string;
    updates: Partial<Organization>;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    // Verificar permissões
    if (user.role !== 'superadmin' && (user.organizationId !== data.organizationId || user.role !== 'admin')) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para atualizar esta organização');
    }
    
    // Campos que apenas superadmin pode alterar
    const superadminOnlyFields = ['plan', 'status', 'limits', 'billing'];
    if (user.role !== 'superadmin') {
      for (const field of superadminOnlyFields) {
        if (data.updates.hasOwnProperty(field)) {
          delete (data.updates as any)[field];
        }
      }
    }
    
    const updates = {
      ...data.updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('organizations').doc(data.organizationId).update(updates);
    
    return { success: true };
  }
);

/**
 * Obter organização
 */
export const getOrganization = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    organizationId?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    const orgId = data.organizationId || user.organizationId;
    
    // Verificar permissões
    if (user.role !== 'superadmin' && user.organizationId !== orgId) {
      throw new functions.https.HttpsError('permission-denied', 'Sem permissão para acessar esta organização');
    }
    
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organização não encontrada');
    }
    
    return {
      id: orgDoc.id,
      ...orgDoc.data(),
    };
  }
);

/**
 * Listar organizações (apenas superadmin)
 */
export const listOrganizations = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    page?: number;
    limit?: number;
    status?: OrganizationStatus;
    plan?: PlanType;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (user.role !== 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas superadmins podem listar organizações');
    }
    
    const page = data.page || 1;
    const limit = data.limit || 20;
    const offset = (page - 1) * limit;
    
    let query = db.collection('organizations').orderBy('createdAt', 'desc');
    
    if (data.status) {
      query = query.where('status', '==', data.status);
    }
    
    if (data.plan) {
      query = query.where('plan', '==', data.plan);
    }
    
    const snapshot = await query.limit(limit).offset(offset).get();
    
    const organizations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Contar total
    const totalSnapshot = await db.collection('organizations').get();
    const total = totalSnapshot.size;
    
    return {
      organizations,
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
 * Suspender organização
 */
export const suspendOrganization = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    organizationId: string;
    reason?: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (user.role !== 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas superadmins podem suspender organizações');
    }
    
    await db.collection('organizations').doc(data.organizationId).update({
      status: 'suspended',
      suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
      suspendedBy: auth.uid,
      suspensionReason: data.reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Desativar todos os usuários da organização
    const usersSnapshot = await db.collection('organizations')
      .doc(data.organizationId)
      .collection('users')
      .get();
    
    const batch = db.batch();
    usersSnapshot.docs.forEach(userDoc => {
      batch.update(userDoc.ref, {
        status: 'suspended',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    await batch.commit();
    
    return { success: true };
  }
);

/**
 * Reativar organização
 */
export const reactivateOrganization = functions.https.onCall(
  async (request: functions.https.CallableRequest<{
    organizationId: string;
  }>) => {
    const { auth, data } = request;
    
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const user = userDoc.data() as User;
    
    if (user.role !== 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas superadmins podem reativar organizações');
    }
    
    await db.collection('organizations').doc(data.organizationId).update({
      status: 'active',
      reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reactivatedBy: auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Reativar usuários da organização
    const usersSnapshot = await db.collection('organizations')
      .doc(data.organizationId)
      .collection('users')
      .where('status', '==', 'suspended')
      .get();
    
    const batch = db.batch();
    usersSnapshot.docs.forEach(userDoc => {
      batch.update(userDoc.ref, {
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    await batch.commit();
    
    return { success: true };
  }
);

// ========== FUNÇÕES AUXILIARES ==========

function getPlanLimits(plan: PlanType) {
  const planConfigs = {
    basic: {
      limits: {
        users: 3,
        leads: 1000,
        storage: 1, // GB
        apiCalls: 10000,
        campaigns: 5,
        automations: 3,
        integrations: 2,
      },
      features: [
        'leads_management',
        'basic_analytics',
        'email_integration',
        'whatsapp_basic',
      ],
    },
    pro: {
      limits: {
        users: 10,
        leads: 10000,
        storage: 10,
        apiCalls: 100000,
        campaigns: 25,
        automations: 15,
        integrations: 10,
      },
      features: [
        'leads_management',
        'advanced_analytics',
        'email_integration',
        'whatsapp_advanced',
        'dialogflow',
        'automations',
        'campaigns',
        'custom_fields',
        'api_access',
      ],
    },
    enterprise: {
      limits: {
        users: 100,
        leads: 100000,
        storage: 100,
        apiCalls: 1000000,
        campaigns: 100,
        automations: 50,
        integrations: 50,
      },
      features: [
        'leads_management',
        'advanced_analytics',
        'email_integration',
        'whatsapp_advanced',
        'dialogflow',
        'automations',
        'campaigns',
        'custom_fields',
        'api_access',
        'whitelabel',
        'custom_integrations',
        'priority_support',
        'sla_guarantee',
      ],
    },
    custom: {
      limits: {
        users: 1000,
        leads: 1000000,
        storage: 1000,
        apiCalls: 10000000,
        campaigns: 1000,
        automations: 500,
        integrations: 100,
      },
      features: [
        'all_features',
        'custom_development',
        'dedicated_support',
        'on_premise_option',
      ],
    },
  };
  
  return planConfigs[plan];
}

function getDefaultPermissions(role: string) {
  const permissions = {
    superadmin: [
      { resource: '*', actions: ['*'] },
    ],
    admin: [
      { resource: 'organization', actions: ['read', 'update'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'companies', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'campaigns', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'automations', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'settings', actions: ['read', 'update'] },
    ],
    manager: [
      { resource: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'companies', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'campaigns', actions: ['create', 'read', 'update'] },
      { resource: 'automations', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'users', actions: ['read'] },
    ],
    agent: [
      { resource: 'leads', actions: ['create', 'read', 'update'] },
      { resource: 'companies', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] },
    ],
    viewer: [
      { resource: 'leads', actions: ['read'] },
      { resource: 'companies', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] },
    ],
  };
  
  return permissions[role] || permissions.viewer;
}

function getDefaultDashboardWidgets() {
  return [
    {
      id: 'leads_overview',
      type: 'leads_overview',
      position: { x: 0, y: 0, w: 6, h: 4 },
      config: {},
    },
    {
      id: 'sales_funnel',
      type: 'sales_funnel',
      position: { x: 6, y: 0, w: 6, h: 4 },
      config: {},
    },
    {
      id: 'recent_leads',
      type: 'recent_leads',
      position: { x: 0, y: 4, w: 12, h: 6 },
      config: { limit: 10 },
    },
  ];
}

async function createDefaultSettings(organizationId: string) {
  const batch = db.batch();
  
  // Configurações de lead
  const leadSettingsRef = db.collection('organizations')
    .doc(organizationId)
    .collection('settings')
    .doc('leads');
  
  batch.set(leadSettingsRef, {
    statuses: [
      { id: 'new', name: 'Novo', color: '#3B82F6', order: 1 },
      { id: 'contacted', name: 'Contatado', color: '#8B5CF6', order: 2 },
      { id: 'qualified', name: 'Qualificado', color: '#F59E0B', order: 3 },
      { id: 'proposal', name: 'Proposta', color: '#EF4444', order: 4 },
      { id: 'negotiation', name: 'Negociação', color: '#F97316', order: 5 },
      { id: 'won', name: 'Ganho', color: '#10B981', order: 6 },
      { id: 'lost', name: 'Perdido', color: '#6B7280', order: 7 },
    ],
    sources: [
      { id: 'website', name: 'Website', color: '#3B82F6' },
      { id: 'whatsapp', name: 'WhatsApp', color: '#10B981' },
      { id: 'facebook', name: 'Facebook', color: '#1877F2' },
      { id: 'instagram', name: 'Instagram', color: '#E4405F' },
      { id: 'google', name: 'Google', color: '#4285F4' },
      { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
      { id: 'email', name: 'Email', color: '#F59E0B' },
      { id: 'phone', name: 'Telefone', color: '#8B5CF6' },
      { id: 'referral', name: 'Indicação', color: '#EF4444' },
      { id: 'manual', name: 'Manual', color: '#6B7280' },
    ],
    customFields: [],
    defaultTags: ['quente', 'frio', 'morno', 'vip', 'follow-up'],
  });
  
  // Configurações de email
  const emailSettingsRef = db.collection('organizations')
    .doc(organizationId)
    .collection('settings')
    .doc('email');
  
  batch.set(emailSettingsRef, {
    provider: 'sendgrid',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    signature: '',
    templates: [],
  });
  
  // Configurações de WhatsApp
  const whatsappSettingsRef = db.collection('organizations')
    .doc(organizationId)
    .collection('settings')
    .doc('whatsapp');
  
  batch.set(whatsappSettingsRef, {
    provider: 'twilio',
    phoneNumber: '',
    businessHours: {
      enabled: true,
      timezone: 'America/Sao_Paulo',
      schedule: {
        monday: { start: '09:00', end: '18:00', enabled: true },
        tuesday: { start: '09:00', end: '18:00', enabled: true },
        wednesday: { start: '09:00', end: '18:00', enabled: true },
        thursday: { start: '09:00', end: '18:00', enabled: true },
        friday: { start: '09:00', end: '18:00', enabled: true },
        saturday: { start: '09:00', end: '12:00', enabled: false },
        sunday: { start: '09:00', end: '12:00', enabled: false },
      },
    },
    autoResponses: {
      welcome: 'Olá! Obrigado por entrar em contato. Em breve um de nossos consultores irá atendê-lo.',
      businessHours: 'No momento estamos fora do horário de atendimento. Nosso horário é de segunda a sexta, das 9h às 18h.',
      handoff: 'Você está sendo transferido para um de nossos consultores. Aguarde um momento.',
    },
  });
  
  await batch.commit();
}

async function updateOrganizationUsage(organizationId: string, updates: Partial<Organization['usage']>) {
  await db.collection('organizations').doc(organizationId).update({
    [`usage.${Object.keys(updates)[0]}`]: admin.firestore.FieldValue.increment(Object.values(updates)[0] as number),
    'usage.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
  });
}

