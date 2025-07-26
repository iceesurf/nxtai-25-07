import { BaseEntity, Status } from './common';

export interface Agent extends BaseEntity {
  name: string;
  description: string;
  avatar?: string;
  status: Status;
  type: AgentType;
  configuration: AgentConfiguration;
  dialogflowConfig: DialogflowConfig;
  anthropicConfig?: AnthropicConfig;
  metrics: AgentMetrics;
  tags: string[];
  organizationId: string;
}

export type AgentType = 'chatbot' | 'voice' | 'hybrid';

export interface AgentConfiguration {
  welcomeMessage: string;
  fallbackMessage: string;
  language: string;
  timeoutMinutes: number;
  maxConversationLength: number;
  personality: AgentPersonality;
  integrations: Integration[];
  workflows: Workflow[];
}

export interface AgentPersonality {
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  style: 'concise' | 'detailed' | 'conversational';
  empathy: 'low' | 'medium' | 'high';
  proactivity: 'reactive' | 'proactive' | 'very_proactive';
}

export interface DialogflowConfig {
  projectId: string;
  location: string;
  agentId: string;
  languageCode: string;
  timeZone: string;
  environment?: string;
}

export interface AnthropicConfig {
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku';
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  contextWindow: number;
}

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: IntegrationConfig;
}

export type IntegrationType = 
  | 'whatsapp' 
  | 'telegram' 
  | 'facebook' 
  | 'instagram' 
  | 'webchat' 
  | 'api'
  | 'email'
  | 'sms';

export interface IntegrationConfig {
  [key: string]: any;
  webhook?: {
    url: string;
    secret: string;
  };
  credentials?: {
    token?: string;
    apiKey?: string;
    phoneNumber?: string;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  conditions: WorkflowCondition[];
  enabled: boolean;
}

export interface WorkflowTrigger {
  type: 'intent' | 'keyword' | 'sentiment' | 'timeout' | 'api';
  config: Record<string, any>;
}

export interface WorkflowAction {
  type: 'message' | 'api_call' | 'transfer' | 'tag' | 'variable_set';
  config: Record<string, any>;
  order: number;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
}

export interface AgentMetrics {
  totalConversations: number;
  activeConversations: number;
  averageResponseTime: number;
  satisfactionScore: number;
  resolutionRate: number;
  handoffRate: number;
  lastActive: Date;
  uptime: number;
}