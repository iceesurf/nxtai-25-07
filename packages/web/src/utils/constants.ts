// App Constants
export const APP_NAME = 'NXT.AI';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Plataforma de Automação Inteligente';

// API Constants
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_TIMEOUT = 30000; // 30 seconds

// Firebase Constants
export const COLLECTIONS = {
  USERS: 'users',
  AGENTS: 'agents',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  ORGANIZATIONS: 'organizations',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings'
} as const;

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  VIEWER: 'viewer'
} as const;

// Permissions
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  USERS_DELETE: 'users.delete',
  AGENTS_READ: 'agents.read',
  AGENTS_WRITE: 'agents.write',
  AGENTS_DELETE: 'agents.delete',
  CONVERSATIONS_READ: 'conversations.read',
  CONVERSATIONS_WRITE: 'conversations.write',
  ANALYTICS_READ: 'analytics.read',
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
  BILLING_READ: 'billing.read',
  BILLING_WRITE: 'billing.write'
} as const;

// Plan Types
export const PLAN_TYPES = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const;

// Plan Limits
export const PLAN_LIMITS = {
  [PLAN_TYPES.FREE]: {
    agents: 1,
    conversations: 100,
    messages: 1000,
    users: 2,
    storage: 100 // MB
  },
  [PLAN_TYPES.BASIC]: {
    agents: 3,
    conversations: 1000,
    messages: 10000,
    users: 5,
    storage: 500 // MB
  },
  [PLAN_TYPES.PRO]: {
    agents: 10,
    conversations: 5000,
    messages: 50000,
    users: 20,
    storage: 2000 // MB
  },
  [PLAN_TYPES.ENTERPRISE]: {
    agents: -1, // unlimited
    conversations: -1,
    messages: -1,
    users: -1,
    storage: -1
  }
} as const;

// Agent Types
export const AGENT_TYPES = {
  SUPPORT: 'support',
  SALES: 'sales',
  MARKETING: 'marketing',
  GENERAL: 'general'
} as const;

// Agent Status
export const AGENT_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  ERROR: 'error',
  TRAINING: 'training'
} as const;

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  LOCATION: 'location',
  CONTACT: 'contact',
  STICKER: 'sticker',
  QUICK_REPLY: 'quick_reply',
  BUTTON: 'button',
  CARD: 'card'
} as const;

// Message Status
export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  PENDING: 'pending'
} as const;

// Conversation Status
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  RESOLVED: 'resolved',
  TRANSFERRED: 'transferred',
  ABANDONED: 'abandoned',
  ARCHIVED: 'archived'
} as const;

// Channels
export const CHANNELS = {
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  WEBCHAT: 'webchat',
  API: 'api',
  EMAIL: 'email',
  SMS: 'sms',
  VOICE: 'voice'
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/json'
  ],
  ALLOWED_EXTENSIONS: [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'txt', 'csv', 'json'
  ]
} as const;

// Analytics
export const ANALYTICS_PERIODS = {
  LAST_24_HOURS: '24h',
  LAST_7_DAYS: '7d',
  LAST_30_DAYS: '30d',
  LAST_90_DAYS: '90d',
  LAST_YEAR: '1y'
} as const;

// Themes
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
} as const;

// Languages
export const LANGUAGES = {
  PT_BR: 'pt-BR',
  EN_US: 'en-US',
  ES_ES: 'es-ES'
} as const;

// Date Formats
export const DATE_FORMATS = {
  SHORT: 'dd/MM/yyyy',
  LONG: 'dd \'de\' MMMM \'de\' yyyy',
  TIME: 'HH:mm',
  DATETIME: 'dd/MM/yyyy HH:mm',
  ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx'
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  DISPLAY_NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
  MESSAGE_MAX_LENGTH: 4000
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const;

// Error Codes
export const ERROR_CODES = {
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;

// Storage Paths
export const STORAGE_PATHS = {
  AVATARS: 'avatars',
  ATTACHMENTS: 'attachments',
  EXPORTS: 'exports',
  TEMP: 'temp'
} as const;

// Feature Flags
export const FEATURES = {
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
  ANTHROPIC_INTEGRATION: import.meta.env.VITE_ANTHROPIC_API_KEY !== undefined,
  OPENAI_INTEGRATION: import.meta.env.VITE_OPENAI_API_KEY !== undefined
} as const;

// Regular Expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{8,}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
} as const;