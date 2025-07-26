import { EntityTypesClient } from '@google-cloud/dialogflow-cx';

export interface EntityType {
  name?: string;
  displayName: string;
  kind: 'KIND_MAP' | 'KIND_LIST' | 'KIND_REGEXP';
  autoExpansionMode?: 'AUTO_EXPANSION_MODE_DEFAULT' | 'AUTO_EXPANSION_MODE_UNSPECIFIED';
  entities: Entity[];
  excludedPhrases?: ExcludedPhrase[];
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

export interface EntityConfig {
  projectId: string;
  location: string;
  agentId: string;
}

export class EntityService {
  private client: EntityTypesClient;
  private config: EntityConfig;

  constructor(config: EntityConfig) {
    this.client = new EntityTypesClient();
    this.config = config;
  }

  private getParentPath(): string {
    return this.client.agentPath(
      this.config.projectId,
      this.config.location,
      this.config.agentId
    );
  }

  async createEntityType(entityType: EntityType): Promise<string> {
    try {
      const parent = this.getParentPath();
      
      const request = {
        parent,
        entityType: {
          displayName: entityType.displayName,
          kind: entityType.kind,
          autoExpansionMode: entityType.autoExpansionMode || 'AUTO_EXPANSION_MODE_DEFAULT',
          entities: entityType.entities.map(entity => ({
            value: entity.value,
            synonyms: entity.synonyms
          })),
          excludedPhrases: entityType.excludedPhrases?.map(phrase => ({
            value: phrase.value
          })) || [],
          enableFuzzyExtraction: entityType.enableFuzzyExtraction || false,
          redact: entityType.redact || false
        }
      };

      const [response] = await this.client.createEntityType(request);
      console.log(`✅ Entity type created: ${response.name}`);
      return response.name!;

    } catch (error) {
      console.error('❌ Error creating entity type:', error);
      throw new Error(`Failed to create entity type: ${entityType.displayName}`);
    }
  }

  async getEntityType(entityTypeName: string): Promise<EntityType | null> {
    try {
      const request = { name: entityTypeName };
      const [response] = await this.client.getEntityType(request);

      return {
        name: response.name || undefined,
        displayName: response.displayName!,
        kind: response.kind as 'KIND_MAP' | 'KIND_LIST' | 'KIND_REGEXP',
        autoExpansionMode: response.autoExpansionMode as 'AUTO_EXPANSION_MODE_DEFAULT' | 'AUTO_EXPANSION_MODE_UNSPECIFIED',
        entities: response.entities?.map(entity => ({
          value: entity.value!,
          synonyms: entity.synonyms || []
        })) || [],
        excludedPhrases: response.excludedPhrases?.map(phrase => ({
          value: phrase.value!
        })) || [],
        enableFuzzyExtraction: response.enableFuzzyExtraction || undefined,
        redact: response.redact || undefined
      };

    } catch (error) {
      console.error('❌ Error getting entity type:', error);
      return null;
    }
  }

  async listEntityTypes(): Promise<EntityType[]> {
    try {
      const parent = this.getParentPath();
      const request = { parent };
      
      const [entityTypes] = await this.client.listEntityTypes(request);
      
      return entityTypes.map(entityType => ({
        name: entityType.name || undefined,
        displayName: entityType.displayName!,
        kind: entityType.kind as 'KIND_MAP' | 'KIND_LIST' | 'KIND_REGEXP',
        autoExpansionMode: entityType.autoExpansionMode as 'AUTO_EXPANSION_MODE_DEFAULT' | 'AUTO_EXPANSION_MODE_UNSPECIFIED',
        entities: entityType.entities?.map(entity => ({
          value: entity.value!,
          synonyms: entity.synonyms || []
        })) || [],
        excludedPhrases: entityType.excludedPhrases?.map(phrase => ({
          value: phrase.value!
        })) || [],
        enableFuzzyExtraction: entityType.enableFuzzyExtraction || undefined,
        redact: entityType.redact || undefined
      }));

    } catch (error) {
      console.error('❌ Error listing entity types:', error);
      throw new Error('Failed to list entity types');
    }
  }

  async updateEntityType(entityTypeName: string, updates: Partial<EntityType>): Promise<void> {
    try {
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type not found: ${entityTypeName}`);
      }

      const updatedEntityType = { ...currentEntityType, ...updates };
      
      const request = {
        entityType: {
          name: entityTypeName,
          displayName: updatedEntityType.displayName,
          kind: updatedEntityType.kind,
          autoExpansionMode: updatedEntityType.autoExpansionMode,
          entities: updatedEntityType.entities.map(entity => ({
            value: entity.value,
            synonyms: entity.synonyms
          })),
          excludedPhrases: updatedEntityType.excludedPhrases?.map(phrase => ({
            value: phrase.value
          })) || [],
          enableFuzzyExtraction: updatedEntityType.enableFuzzyExtraction,
          redact: updatedEntityType.redact
        }
      };

      await this.client.updateEntityType(request);
      console.log(`✅ Entity type updated: ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Error updating entity type:', error);
      throw new Error(`Failed to update entity type: ${entityTypeName}`);
    }
  }

  async deleteEntityType(entityTypeName: string): Promise<void> {
    try {
      const request = { name: entityTypeName };
      await this.client.deleteEntityType(request);
      console.log(`✅ Entity type deleted: ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Error deleting entity type:', error);
      throw new Error(`Failed to delete entity type: ${entityTypeName}`);
    }
  }

  async addEntities(entityTypeName: string, entities: Entity[]): Promise<void> {
    try {
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type not found: ${entityTypeName}`);
      }

      const updatedEntities = [...currentEntityType.entities, ...entities];
      await this.updateEntityType(entityTypeName, { entities: updatedEntities });
      
    } catch (error) {
      console.error('❌ Error adding entities:', error);
      throw new Error(`Failed to add entities to: ${entityTypeName}`);
    }
  }

  async removeEntities(entityTypeName: string, entityValues: string[]): Promise<void> {
    try {
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type not found: ${entityTypeName}`);
      }

      const filteredEntities = currentEntityType.entities.filter(
        entity => !entityValues.includes(entity.value)
      );
      
      await this.updateEntityType(entityTypeName, { entities: filteredEntities });
      
    } catch (error) {
      console.error('❌ Error removing entities:', error);
      throw new Error(`Failed to remove entities from: ${entityTypeName}`);
    }
  }

  async batchCreateEntityTypes(entityTypes: EntityType[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const entityType of entityTypes) {
      try {
        const entityTypeName = await this.createEntityType(entityType);
        results.push(entityTypeName);
      } catch (error) {
        console.error(`❌ Failed to create entity type ${entityType.displayName}:`, error);
      }
    }
    
    return results;
  }

  async exportEntityTypes(): Promise<EntityType[]> {
    return this.listEntityTypes();
  }

  async importEntityTypes(entityTypes: EntityType[]): Promise<void> {
    await this.batchCreateEntityTypes(entityTypes);
  }

  createSystemEntityTypes(): EntityType[] {
    return [
      {
        displayName: 'sys.person',
        kind: 'KIND_MAP',
        entities: [
          { value: 'João', synonyms: ['João Silva', 'João', 'Sr. João'] },
          { value: 'Maria', synonyms: ['Maria Santos', 'Maria', 'Sra. Maria'] },
          { value: 'Pedro', synonyms: ['Pedro Costa', 'Pedro', 'Sr. Pedro'] }
        ],
        enableFuzzyExtraction: true
      },
      {
        displayName: 'sys.company',
        kind: 'KIND_MAP',
        entities: [
          { value: 'Google', synonyms: ['Google Inc', 'Alphabet', 'Google LLC'] },
          { value: 'Microsoft', synonyms: ['Microsoft Corp', 'MSFT', 'Microsoft Corporation'] },
          { value: 'Apple', synonyms: ['Apple Inc', 'AAPL', 'Apple Computer'] }
        ],
        enableFuzzyExtraction: true
      },
      {
        displayName: 'sys.product',
        kind: 'KIND_MAP',
        entities: [
          { value: 'chatbot', synonyms: ['bot', 'assistente virtual', 'robô', 'IA'] },
          { value: 'crm', synonyms: ['CRM', 'sistema de vendas', 'gestão de clientes'] },
          { value: 'automação', synonyms: ['automatização', 'workflow', 'processo'] }
        ],
        enableFuzzyExtraction: true
      }
    ];
  }
}