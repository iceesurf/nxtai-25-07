export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'training';
  language: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  config: AgentConfig;
  metrics: AgentMetrics;
}

export interface AgentConfig {
  welcomeMessage: string;
  fallbackMessage: string;
  maxTurns: number;
  enableSmallTalk: boolean;
  enableSpellCheck: boolean;
  confidenceThreshold: number;
  integrations: {
    whatsapp?: boolean;
    web?: boolean;
    telegram?: boolean;
  };
}

export interface AgentMetrics {
  totalSessions: number;
  averageSessionLength: number;
  successfulIntents: number;
  fallbackRate: number;
  userSatisfaction: number;
}

export interface CreateAgentData {
  name: string;
  description: string;
  language: string;
  projectId: string;
  config: Partial<AgentConfig>;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'training';
  config?: Partial<AgentConfig>;
}