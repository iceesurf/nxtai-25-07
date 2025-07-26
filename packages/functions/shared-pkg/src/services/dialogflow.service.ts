import { SessionsClient } from '@google-cloud/dialogflow-cx';

export interface DialogflowConfig {
  projectId: string;
  location: string;
  agentId: string;
  languageCode: string;
}

export interface DialogflowResponse {
  text: string;
  intent: string;
  confidence: number;
  parameters?: { [key: string]: any };
  sessionInfo?: { [key: string]: any };
}

export class DialogflowService {
  private client: SessionsClient;
  private config: DialogflowConfig;

  constructor(config: DialogflowConfig) {
    this.client = new SessionsClient();
    this.config = config;
  }

  async detectIntent(sessionId: string, query: string): Promise<DialogflowResponse> {
    const sessionPath = this.client.projectLocationAgentSessionPath(
      this.config.projectId,
      this.config.location,
      this.config.agentId,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query
        },
        languageCode: this.config.languageCode
      }
    };

    try {
      const [response] = await this.client.detectIntent(request);
      const result = response.queryResult;

      return {
        text: result?.responseMessages?.[0]?.text?.text?.[0] || '',
        intent: result?.match?.intent?.displayName || 'Default Fallback Intent',
        confidence: result?.match?.confidence || 0,
        parameters: result?.parameters || undefined,
        sessionInfo: (result as any)?.sessionInfo?.parameters || undefined
      };
    } catch (error) {
      console.error('Dialogflow error:', error);
      throw new Error('Failed to detect intent');
    }
  }

  async detectStreamingIntent(sessionId: string) {
    const sessionPath = this.client.projectLocationAgentSessionPath(
      this.config.projectId,
      this.config.location,
      this.config.agentId,
      sessionId
    );

    return this.client.streamingDetectIntent();
  }
}