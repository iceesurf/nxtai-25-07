import { IntentsClient } from '@google-cloud/dialogflow-cx';
import { google } from '@google-cloud/dialogflow-cx/build/protos/protos';

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
  id?: string | null;
  parts: TextPart[];
  repeatCount?: number | null;
}

export interface TextPart {
  text: string;
  parameterId?: string | null;
}

export interface Parameter {
  id: string;
  entityType: string;
  required?: boolean;
  redact?: boolean | null;
  defaultValue?: any;
}

export interface IntentConfig {
  projectId: string;
  location: string;
  agentId: string;
}

export class IntentService {
  private client: IntentsClient;
  private config: IntentConfig;

  constructor(config: IntentConfig) {
    this.client = new IntentsClient();
    this.config = config;
  }

  private getParentPath(): string {
    return this.client.agentPath(
      this.config.projectId,
      this.config.location,
      this.config.agentId
    );
  }

  async createIntent(intent: Intent): Promise<string> {
    try {
      const parent = this.getParentPath();
      
      const trainingPhrases = intent.trainingPhrases.map(phrase => ({
        id: phrase.id,
        parts: phrase.parts.map(part => ({
          text: part.text,
          parameterId: part.parameterId
        })),
        repeatCount: phrase.repeatCount || 1
      }));

      const parameters = intent.parameters.map(param => ({
        id: param.id,
        entityType: param.entityType,
        isList: false,
        redact: param.redact || false,
        required: param.required || false,
        defaultValue: param.defaultValue
      }));

      const request = {
        parent,
        intent: {
          displayName: intent.displayName,
          trainingPhrases,
          parameters,
          priority: intent.priority || 500000,
          isFallback: intent.isFallback || false,
          labels: intent.labels || {}
        }
      };

      const [response] = await this.client.createIntent(request);
      console.log(`✅ Intent created: ${response.name}`);
      return response.name!;

    } catch (error) {
      console.error('❌ Error creating intent:', error);
      throw new Error(`Failed to create intent: ${intent.displayName}`);
    }
  }

  async getIntent(intentName: string): Promise<Intent | null> {
    try {
      const request = { name: intentName };
      const [response] = await this.client.getIntent(request);

      return {
        name: response.name!,
        displayName: response.displayName!,
        trainingPhrases: response.trainingPhrases?.map(phrase => ({
          id: phrase.id,
          parts: phrase.parts?.map(part => ({
            text: part.text || '',
            parameterId: part.parameterId
          })) || [],
          repeatCount: phrase.repeatCount
        })) || [],
        parameters: response.parameters?.map(param => ({
          id: param.id!,
          entityType: param.entityType!,
          redact: param.redact
        })) || [],
        priority: response.priority,
        isFallback: response.isFallback,
        labels: response.labels
      };

    } catch (error) {
      console.error('❌ Error getting intent:', error);
      return null;
    }
  }

  async listIntents(): Promise<Intent[]> {
    try {
      const parent = this.getParentPath();
      const request = { parent };
      
      const [intents] = await this.client.listIntents(request);
      
      return intents.map(intent => ({
        name: intent.name!,
        displayName: intent.displayName!,
        trainingPhrases: intent.trainingPhrases?.map(phrase => ({
          id: phrase.id,
          parts: phrase.parts?.map(part => ({
            text: part.text || '',
            parameterId: part.parameterId
          })) || [],
          repeatCount: phrase.repeatCount
        })) || [],
        parameters: intent.parameters?.map(param => ({
          id: param.id!,
          entityType: param.entityType!,
          redact: param.redact
        })) || [],
        priority: intent.priority,
        isFallback: intent.isFallback,
        labels: intent.labels
      }));

    } catch (error) {
      console.error('❌ Error listing intents:', error);
      throw new Error('Failed to list intents');
    }
  }

  async updateIntent(intentName: string, updates: Partial<Intent>): Promise<void> {
    try {
      const currentIntent = await this.getIntent(intentName);
      if (!currentIntent) {
        throw new Error(`Intent not found: ${intentName}`);
      }

      const updatedIntent = { ...currentIntent, ...updates };
      
      const request = {
        intent: {
          name: intentName,
          displayName: updatedIntent.displayName,
          trainingPhrases: updatedIntent.trainingPhrases.map(phrase => ({
            id: phrase.id,
            parts: phrase.parts.map(part => ({
              text: part.text,
              parameterId: part.parameterId
            })),
            repeatCount: phrase.repeatCount || 1
          })),
          parameters: updatedIntent.parameters.map(param => ({
            id: param.id,
            entityType: param.entityType,
            required: param.required || false,
            redact: param.redact || false,
            defaultValue: param.defaultValue
          })),
          priority: updatedIntent.priority || 500000,
          isFallback: updatedIntent.isFallback || false,
          labels: updatedIntent.labels || {}
        }
      };

      await this.client.updateIntent(request);
      console.log(`✅ Intent updated: ${intentName}`);

    } catch (error) {
      console.error('❌ Error updating intent:', error);
      throw new Error(`Failed to update intent: ${intentName}`);
    }
  }

  async deleteIntent(intentName: string): Promise<void> {
    try {
      const request = { name: intentName };
      await this.client.deleteIntent(request);
      console.log(`✅ Intent deleted: ${intentName}`);

    } catch (error) {
      console.error('❌ Error deleting intent:', error);
      throw new Error(`Failed to delete intent: ${intentName}`);
    }
  }

  async batchCreateIntents(intents: Intent[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const intent of intents) {
      try {
        const intentName = await this.createIntent(intent);
        results.push(intentName);
      } catch (error) {
        console.error(`❌ Failed to create intent ${intent.displayName}:`, error);
      }
    }
    
    return results;
  }

  async exportIntents(): Promise<Intent[]> {
    return this.listIntents();
  }

  async importIntents(intents: Intent[]): Promise<void> {
    await this.batchCreateIntents(intents);
  }
}
