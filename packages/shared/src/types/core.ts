import { Timestamp } from 'firebase/firestore';

// ========== TIPOS BÁSICOS ==========

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'agent' | 'viewer';
export type OrganizationStatus = 'active' | 'suspended' | 'cancelled' | 'trial';
export type PlanType = 'basic' | 'pro' | 'enterprise' | 'custom';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'nurturing';
export type LeadSource = 'website' | 'whatsapp' | 'facebook' | 'instagram' | 'google' | 'linkedin' | 'email' | 'phone' | 'referral' | 'manual' | 'api';
export type InteractionType = 'email' | 'whatsapp' | 'call' | 'meeting' | 'note' | 'task' | 'system' | 'sms';
export type InteractionDirection = 'inbound' | 'outbound';
export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
export type CampaignType = 'email' | 'sms' | 'whatsapp' | 'social' | 'ads';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
export type AutomationTrigger = 'lead_created' | 'lead_status_changed' | 'interaction_added' | 'time_based' | 'manual';
export type IntegrationType = 'webhook' | 'api' | 'email' | 'crm' | 'marketing' | 'analytics';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ========== INTERFACES PRINCIPAIS ==========

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  plan: PlanType;
  status: OrganizationStatus;
  
  // Configurações de whitelabel
  whitelabel: {
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    companyName?: string;
    customCss?: string;
    customDomain?: string;
  };
  
  // Configurações gerais
  settings: {
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
    timeFormat: string;
    features: string[];
    customFields: CustomField[];
  };
  
  // Limites do plano
  limits: {
    users: number;
    leads: number;
    storage: number; // em GB
    apiCalls: number; // por mês
    campaigns: number;
    automations: number;
    integrations: number;
  };
  
  // Uso atual
  usage: {
    users: number;
    leads: number;
    storage: number;
    apiCalls: number;
    campaigns: number;
    automations: number;
    integrations: number;
    lastUpdated: Timestamp;
  };
  
  // Informações de cobrança
  billing: {
    customerId?: string; // Stripe customer ID
    subscriptionId?: string;
    nextBillingDate?: Timestamp;
    paymentMethod?: string;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  trialEndsAt?: Timestamp;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  phone?: string;
  
  // Multi-tenancy
  organizationId: string;
  role: UserRole;
  permissions: Permission[];
  
  // Status e configurações
  status: 'active' | 'inactive' | 'suspended';
  isEmailVerified: boolean;
  preferences: {
    language: string;
    timezone: string;
    notifications: NotificationPreferences;
    dashboard: DashboardPreferences;
  };
  
  // Informações de acesso
  lastLogin?: Timestamp;
  lastActivity?: Timestamp;
  loginCount: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  invitedAt?: Timestamp;
  invitedBy?: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  
  // Informações detalhadas
  company?: string;
  position?: string;
  website?: string;
  linkedin?: string;
  
  // Origem e rastreamento
  source: LeadSource;
  sourceDetails?: {
    campaign?: string;
    adset?: string;
    ad?: string;
    keyword?: string;
    landingPage?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
  
  // Status e responsável
  status: LeadStatus;
  assignedTo?: string; // userId
  previousStatus?: LeadStatus;
  score?: number; // Lead scoring (0-100)
  temperature?: 'cold' | 'warm' | 'hot';
  
  // Classificação e tags
  tags: string[];
  customFields: Record<string, any>;
  notes?: string;
  
  // Dados de localização
  location?: {
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Informações comerciais
  estimatedValue?: number;
  probability?: number; // 0-100
  expectedCloseDate?: Timestamp;
  actualCloseDate?: Timestamp;
  lostReason?: string;
  
  // Métricas
  interactionCount: number;
  lastInteractionType?: InteractionType;
  responseTime?: number; // em minutos
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactAt?: Timestamp;
  convertedAt?: Timestamp;
  qualifiedAt?: Timestamp;
  
  // Metadados
  createdBy?: string;
  updatedBy?: string;
  isArchived: boolean;
}

export interface LeadInteraction {
  id: string;
  organizationId: string;
  leadId: string;
  userId?: string; // Quem realizou a interação
  
  // Tipo e direção
  type: InteractionType;
  direction?: InteractionDirection;
  
  // Conteúdo
  content: {
    subject?: string;
    body?: string;
    attachments?: Attachment[];
    duration?: number; // Para calls/meetings em minutos
    outcome?: string;
    nextAction?: string;
  };
  
  // Metadados específicos por tipo
  metadata?: {
    messageId?: string; // Para rastreamento de emails/whatsapp
    threadId?: string;
    recordingUrl?: string; // Para calls
    meetingUrl?: string;
    meetingPlatform?: string;
    emailProvider?: string;
    whatsappMessageId?: string;
    phoneNumber?: string;
    callerId?: string;
  };
  
  // Status
  isRead: boolean;
  isImportant: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  scheduledAt?: Timestamp;
  completedAt?: Timestamp;
}

export interface Company {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  domain?: string;
  website?: string;
  description?: string;
  
  // Classificação
  industry?: string;
  size?: CompanySize;
  revenue?: number;
  employees?: number;
  
  // Localização
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Contatos e relacionamentos
  contacts: string[]; // leadIds
  primaryContact?: string; // leadId
  
  // Informações comerciais
  totalValue?: number;
  activeDeals?: number;
  wonDeals?: number;
  lostDeals?: number;
  
  // Dados personalizados
  customFields: Record<string, any>;
  tags: string[];
  notes?: string;
  
  // Social e online
  socialMedia?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy?: string;
  updatedBy?: string;
  isArchived: boolean;
}

export interface Campaign {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  
  // Configurações
  settings: {
    subject?: string; // Para email
    content: string;
    template?: string;
    sendTime?: Timestamp;
    timezone?: string;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
  
  // Segmentação
  targeting: {
    leadIds?: string[];
    filters?: LeadFilter[];
    tags?: string[];
    excludeTags?: string[];
  };
  
  // Métricas
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    converted: number;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scheduledAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Automation {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  description?: string;
  isActive: boolean;
  
  // Trigger
  trigger: {
    type: AutomationTrigger;
    conditions: AutomationCondition[];
    delay?: number; // em minutos
  };
  
  // Ações
  actions: AutomationAction[];
  
  // Configurações
  settings: {
    maxExecutions?: number;
    cooldownPeriod?: number; // em minutos
    timezone?: string;
  };
  
  // Métricas
  metrics: {
    triggered: number;
    executed: number;
    failed: number;
    lastExecution?: Timestamp;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Integration {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  type: IntegrationType;
  provider: string;
  isActive: boolean;
  
  // Configurações
  config: {
    apiKey?: string;
    apiSecret?: string;
    webhookUrl?: string;
    endpoints?: Record<string, string>;
    headers?: Record<string, string>;
    authentication?: {
      type: 'api_key' | 'oauth' | 'basic' | 'bearer';
      credentials: Record<string, any>;
    };
  };
  
  // Mapeamento de dados
  mapping?: {
    fields: Record<string, string>;
    transformations?: Record<string, any>;
  };
  
  // Métricas
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastSync?: Timestamp;
    lastError?: string;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface WhatsAppConversation {
  id: string;
  organizationId: string;
  leadId?: string;
  
  // Informações do contato
  phoneNumber: string;
  contactName?: string;
  
  // Status da conversa
  status: 'active' | 'closed' | 'archived';
  assignedTo?: string; // userId
  
  // Configurações
  isBot: boolean;
  botHandoff?: boolean;
  
  // Métricas
  messageCount: number;
  lastMessageAt?: Timestamp;
  responseTime?: number; // em minutos
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WhatsAppMessage {
  id: string;
  organizationId: string;
  conversationId: string;
  
  // Conteúdo
  content: {
    text?: string;
    media?: {
      type: 'image' | 'video' | 'audio' | 'document';
      url: string;
      caption?: string;
      filename?: string;
    };
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
  };
  
  // Metadados
  direction: InteractionDirection;
  messageId: string; // WhatsApp message ID
  status: 'sent' | 'delivered' | 'read' | 'failed';
  
  // Remetente
  from: {
    phoneNumber: string;
    name?: string;
    isBot?: boolean;
    userId?: string;
  };
  
  // Timestamps
  createdAt: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
}

export interface DialogflowAgent {
  id: string;
  organizationId: string;
  
  // Configurações do agente
  name: string;
  description?: string;
  language: string;
  timeZone: string;
  
  // Configurações do projeto Google Cloud
  projectId: string;
  location: string;
  
  // Configurações de integração
  webhookUrl?: string;
  isActive: boolean;
  
  // Métricas
  metrics: {
    totalSessions: number;
    totalMessages: number;
    averageSessionDuration: number;
    handoffRate: number;
    lastActivity?: Timestamp;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  
  // Conteúdo
  title: string;
  message: string;
  type: NotificationType;
  
  // Ação
  action?: {
    type: 'navigate' | 'external' | 'modal';
    payload: any;
  };
  
  // Status
  isRead: boolean;
  isArchived: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  readAt?: Timestamp;
  expiresAt?: Timestamp;
}

export interface Task {
  id: string;
  organizationId: string;
  
  // Informações básicas
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  
  // Atribuição
  assignedTo: string; // userId
  assignedBy?: string; // userId
  
  // Relacionamentos
  leadId?: string;
  companyId?: string;
  campaignId?: string;
  
  // Prazos
  dueDate?: Timestamp;
  estimatedDuration?: number; // em minutos
  
  // Progresso
  progress: number; // 0-100
  timeSpent?: number; // em minutos
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Template {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  description?: string;
  type: 'email' | 'whatsapp' | 'sms' | 'proposal';
  category?: string;
  
  // Conteúdo
  content: {
    subject?: string;
    body: string;
    variables?: TemplateVariable[];
  };
  
  // Configurações
  isActive: boolean;
  isDefault: boolean;
  
  // Métricas de uso
  usageCount: number;
  lastUsed?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Product {
  id: string;
  organizationId: string;
  
  // Informações básicas
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  
  // Preços
  price: number;
  currency: string;
  costPrice?: number;
  
  // Status
  isActive: boolean;
  isRecurring: boolean;
  
  // Configurações de recorrência
  recurring?: {
    interval: 'monthly' | 'quarterly' | 'yearly';
    intervalCount: number;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

export interface Proposal {
  id: string;
  organizationId: string;
  leadId: string;
  
  // Informações básicas
  title: string;
  description?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  
  // Itens da proposta
  items: ProposalItem[];
  
  // Valores
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  currency: string;
  
  // Configurações
  validUntil?: Timestamp;
  terms?: string;
  notes?: string;
  
  // Rastreamento
  viewCount: number;
  lastViewedAt?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
  
  // Metadados
  createdBy: string;
  updatedBy?: string;
}

// ========== TIPOS AUXILIARES ==========

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  options?: string[];
  required: boolean;
  defaultValue?: any;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  leadAssigned: boolean;
  leadStatusChanged: boolean;
  newMessage: boolean;
  taskDue: boolean;
  campaignCompleted: boolean;
}

export interface DashboardPreferences {
  widgets: DashboardWidget[];
  layout: 'grid' | 'list';
  refreshInterval: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy?: string;
  uploadedAt: Timestamp;
}

export interface LeadFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutomationAction {
  type: 'send_email' | 'send_whatsapp' | 'create_task' | 'update_lead' | 'add_tag' | 'remove_tag' | 'assign_user' | 'webhook';
  config: Record<string, any>;
  delay?: number; // em minutos
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date';
  defaultValue?: any;
  required: boolean;
}

export interface ProposalItem {
  id: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ========== TIPOS DE ANALYTICS ==========

export interface AnalyticsData {
  organizationId: string;
  date: string;
  
  // Métricas de leads
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  
  // Funil de vendas
  funnel: {
    new: number;
    contacted: number;
    qualified: number;
    proposal: number;
    negotiation: number;
    won: number;
    lost: number;
  };
  
  // Leads por fonte
  leadsBySource: Record<LeadSource, number>;
  
  // Leads por usuário
  leadsByUser: Record<string, number>;
  
  // Métricas de conversão
  conversionRate: number;
  averageResponseTime: number;
  averageDealSize: number;
  
  // Métricas de comunicação
  totalInteractions: number;
  emailsSent: number;
  whatsappMessages: number;
  callsMade: number;
  
  // Timestamps
  calculatedAt: Timestamp;
}

// ========== TIPOS DE API ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

