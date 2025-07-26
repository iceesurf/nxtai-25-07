export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
  };
  integrations: {
    whatsapp?: WhatsAppConfig;
    email?: EmailConfig;
    sms?: SMSConfig;
  };
  features: {
    chatbot: boolean;
    crm: boolean;
    campaigns: boolean;
    analytics: boolean;
  };
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookToken: string;
  businessAccountId: string;
}

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'ses';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface SMSConfig {
  provider: 'twilio' | 'nexmo';
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: 'chat' | 'whatsapp' | 'email' | 'form' | 'manual';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  tags: string[];
  customFields: { [key: string]: any };
  assignedTo?: string;
  notes: Note[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  tenantId: string;
  sessionId: string;
  channel: 'web' | 'whatsapp' | 'email';
  userId?: string;
  leadId?: string;
  status: 'active' | 'resolved' | 'escalated';
  messages: Message[];
  metadata: {
    userAgent?: string;
    ip?: string;
    referrer?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'user' | 'bot' | 'agent';
  type: 'text' | 'image' | 'file' | 'card' | 'quick_reply';
  intent?: string;
  confidence?: number;
  timestamp: Date;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  type: 'email' | 'whatsapp' | 'sms';
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  audience: CampaignAudience;
  content: CampaignContent;
  schedule?: {
    sendAt: Date;
    timezone: string;
  };
  analytics: CampaignAnalytics;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignAudience {
  type: 'all' | 'segment' | 'list';
  filters?: {
    tags?: string[];
    status?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  leadIds?: string[];
}

export interface CampaignContent {
  subject?: string;
  body: string;
  templateId?: string;
  attachments?: string[];
}

export interface CampaignAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dialogflow Types
export interface EntityType {
  name?: string;
  displayName: string;
  kind: 'KIND_MAP' | 'KIND_LIST' | 'KIND_REGEXP';
  autoExpansionMode: 'AUTO_EXPANSION_MODE_DEFAULT' | 'AUTO_EXPANSION_MODE_UNSPECIFIED';
  entities: Entity[];
  excludedPhrases: ExcludedPhrase[];
  enableFuzzyExtraction?: boolean;
  redact?: boolean;
}

export interface Entity {
  value: string;
  synonyms: string[];
}

export interface ExcludedPhrase {
  value: string;
}

export interface Intent {
  name: string;
  displayName: string;
  trainingPhrases: TrainingPhrase[];
  parameters: Parameter[];
  priority?: number;
  isFallback?: boolean;
  labels?: { [key: string]: string };
}

export interface TrainingPhrase {
  id?: string;
  parts: TrainingPhrasePart[];
  repeatCount?: number;
}

export interface TrainingPhrasePart {
  text: string;
  parameterId?: string;
}

export interface Parameter {
  id: string;
  entityType: string;
  redact?: boolean;
}

export interface IParameter {
  id: string;
  entityType: string;
  redact?: boolean;
  required?: boolean;
  defaultValue?: any;
}

// Auth Types
export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  customClaims?: {
    role?: string;
    permissions?: string[];
    tenantId?: string;
  };
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
}