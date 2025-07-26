import { BaseEntity, Status } from './common';
import { UserRole, PlanType } from './auth';

export interface User extends BaseEntity {
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: Status;
  organizationId?: string;
  planType: PlanType;
  preferences: UserPreferences;
  lastLoginAt?: Date;
  loginCount: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  dashboard: DashboardPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  types: {
    newConversation: boolean;
    agentError: boolean;
    systemAlert: boolean;
    weeklyReport: boolean;
  };
}

export interface DashboardPreferences {
  defaultView: 'overview' | 'agents' | 'conversations' | 'analytics';
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'activity';
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  logoURL?: string;
  planType: PlanType;
  status: Status;
  settings: OrganizationSettings;
  billing: BillingInfo;
  usage: UsageMetrics;
}

export interface OrganizationSettings {
  allowedDomains: string[];
  ssoEnabled: boolean;
  maxUsers: number;
  maxAgents: number;
  retentionDays: number;
}

export interface BillingInfo {
  customerId?: string;
  subscriptionId?: string;
  planType: PlanType;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate?: Date;
  amount: number;
  currency: string;
}

export interface UsageMetrics {
  currentPeriod: {
    conversations: number;
    messages: number;
    users: number;
    agents: number;
  };
  limits: {
    conversations: number;
    messages: number;
    users: number;
    agents: number;
  };
}