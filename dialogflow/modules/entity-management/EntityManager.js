const { EntityTypesClient } = require('@google-cloud/dialogflow-cx');
const admin = require('firebase-admin');

class EntityManager {
  constructor(config) {
    this.projectId = config.projectId;
    this.location = config.location;
    this.agentId = config.agentId;
    this.entityTypesClient = new EntityTypesClient();
    this.db = admin.firestore();
  }

  /**
   * Criar novo entity type
   */
  async createEntityType(entityData) {
    try {
      console.log(`🏷️ Criando entity type: ${entityData.displayName}`);
      
      const parent = this.entityTypesClient.agentPath(
        this.projectId,
        this.location,
        this.agentId
      );

      const request = {
        parent,
        entityType: {
          displayName: entityData.displayName,
          kind: entityData.kind || 'KIND_MAP',
          autoExpansionMode: entityData.autoExpansionMode || 'AUTO_EXPANSION_MODE_DEFAULT',
          entities: entityData.entities?.map(entity => ({
            value: entity.value,
            synonyms: entity.synonyms || [entity.value]
          })) || [],
          excludedPhrases: entityData.excludedPhrases?.map(phrase => ({
            value: phrase
          })) || [],
          enableFuzzyExtraction: entityData.enableFuzzyExtraction || false,
          redact: entityData.redact || false
        }
      };

      const [response] = await this.entityTypesClient.createEntityType(request);
      
      // Salvar metadata no Firestore
      await this.saveEntityMetadata(response.name, entityData);
      
      console.log(`✅ Entity type criado: ${response.name}`);
      return response.name;

    } catch (error) {
      console.error('❌ Erro ao criar entity type:', error);
      throw new Error(`Falha ao criar entity type: ${entityData.displayName}`);
    }
  }

  /**
   * Listar todos os entity types
   */
  async listEntityTypes() {
    try {
      const parent = this.entityTypesClient.agentPath(
        this.projectId,
        this.location,
        this.agentId
      );

      const [entityTypes] = await this.entityTypesClient.listEntityTypes({ parent });
      
      return entityTypes.map(entityType => ({
        name: entityType.name,
        displayName: entityType.displayName,
        kind: entityType.kind,
        autoExpansionMode: entityType.autoExpansionMode,
        entities: entityType.entities?.map(entity => ({
          value: entity.value,
          synonyms: entity.synonyms || []
        })) || [],
        excludedPhrases: entityType.excludedPhrases?.map(phrase => phrase.value) || [],
        enableFuzzyExtraction: entityType.enableFuzzyExtraction,
        redact: entityType.redact
      }));

    } catch (error) {
      console.error('❌ Erro ao listar entity types:', error);
      throw new Error('Falha ao listar entity types');
    }
  }

  /**
   * Atualizar entity type existente
   */
  async updateEntityType(entityTypeName, updates) {
    try {
      console.log(`🔄 Atualizando entity type: ${entityTypeName}`);
      
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type não encontrado: ${entityTypeName}`);
      }

      const updatedEntityType = { ...currentEntityType, ...updates };
      
      const request = {
        entityType: {
          name: entityTypeName,
          displayName: updatedEntityType.displayName,
          kind: updatedEntityType.kind,
          autoExpansionMode: updatedEntityType.autoExpansionMode,
          entities: updatedEntityType.entities?.map(entity => ({
            value: entity.value,
            synonyms: entity.synonyms || [entity.value]
          })) || [],
          excludedPhrases: updatedEntityType.excludedPhrases?.map(phrase => ({
            value: typeof phrase === 'string' ? phrase : phrase.value
          })) || [],
          enableFuzzyExtraction: updatedEntityType.enableFuzzyExtraction,
          redact: updatedEntityType.redact
        }
      };

      await this.entityTypesClient.updateEntityType(request);
      
      // Atualizar metadata
      await this.updateEntityMetadata(entityTypeName, updates);
      
      console.log(`✅ Entity type atualizado: ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Erro ao atualizar entity type:', error);
      throw new Error(`Falha ao atualizar entity type: ${entityTypeName}`);
    }
  }

  /**
   * Deletar entity type
   */
  async deleteEntityType(entityTypeName) {
    try {
      console.log(`🗑️ Deletando entity type: ${entityTypeName}`);
      
      await this.entityTypesClient.deleteEntityType({ name: entityTypeName });
      
      // Remover metadata
      await this.deleteEntityMetadata(entityTypeName);
      
      console.log(`✅ Entity type deletado: ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Erro ao deletar entity type:', error);
      throw new Error(`Falha ao deletar entity type: ${entityTypeName}`);
    }
  }

  /**
   * Obter entity type específico
   */
  async getEntityType(entityTypeName) {
    try {
      const [response] = await this.entityTypesClient.getEntityType({ name: entityTypeName });
      
      return {
        name: response.name,
        displayName: response.displayName,
        kind: response.kind,
        autoExpansionMode: response.autoExpansionMode,
        entities: response.entities?.map(entity => ({
          value: entity.value,
          synonyms: entity.synonyms || []
        })) || [],
        excludedPhrases: response.excludedPhrases?.map(phrase => phrase.value) || [],
        enableFuzzyExtraction: response.enableFuzzyExtraction,
        redact: response.redact
      };

    } catch (error) {
      console.error('❌ Erro ao obter entity type:', error);
      return null;
    }
  }

  /**
   * Adicionar entidades a um entity type
   */
  async addEntities(entityTypeName, entities) {
    try {
      console.log(`➕ Adicionando ${entities.length} entidades ao ${entityTypeName}`);
      
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type não encontrado: ${entityTypeName}`);
      }

      // Combinar entidades existentes com novas
      const existingEntities = currentEntityType.entities || [];
      const newEntities = entities.map(entity => ({
        value: entity.value,
        synonyms: entity.synonyms || [entity.value]
      }));

      // Evitar duplicatas
      const allEntities = [...existingEntities];
      newEntities.forEach(newEntity => {
        const exists = existingEntities.some(existing => existing.value === newEntity.value);
        if (!exists) {
          allEntities.push(newEntity);
        }
      });

      await this.updateEntityType(entityTypeName, { entities: allEntities });
      
      console.log(`✅ Entidades adicionadas ao ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Erro ao adicionar entidades:', error);
      throw new Error(`Falha ao adicionar entidades: ${entityTypeName}`);
    }
  }

  /**
   * Remover entidades de um entity type
   */
  async removeEntities(entityTypeName, entityValues) {
    try {
      console.log(`➖ Removendo entidades do ${entityTypeName}`);
      
      const currentEntityType = await this.getEntityType(entityTypeName);
      if (!currentEntityType) {
        throw new Error(`Entity type não encontrado: ${entityTypeName}`);
      }

      // Filtrar entidades que não estão na lista de remoção
      const filteredEntities = currentEntityType.entities.filter(
        entity => !entityValues.includes(entity.value)
      );

      await this.updateEntityType(entityTypeName, { entities: filteredEntities });
      
      console.log(`✅ Entidades removidas do ${entityTypeName}`);

    } catch (error) {
      console.error('❌ Erro ao remover entidades:', error);
      throw new Error(`Falha ao remover entidades: ${entityTypeName}`);
    }
  }

  /**
   * Importar entity types em lote
   */
  async batchImportEntityTypes(entityTypesData) {
    try {
      console.log(`📥 Importando ${entityTypesData.length} entity types`);
      
      const results = [];
      
      for (const entityTypeData of entityTypesData) {
        try {
          const validation = this.validateEntityTypeData(entityTypeData);
          if (!validation.isValid) {
            results.push({ 
              success: false, 
              error: validation.errors.join(', '), 
              displayName: entityTypeData.displayName 
            });
            continue;
          }

          const entityTypeName = await this.createEntityType(entityTypeData);
          results.push({ 
            success: true, 
            entityTypeName, 
            displayName: entityTypeData.displayName 
          });

        } catch (error) {
          console.error(`❌ Falha ao importar entity type ${entityTypeData.displayName}:`, error);
          results.push({ 
            success: false, 
            error: error.message, 
            displayName: entityTypeData.displayName 
          });
        }
      }
      
      console.log(`✅ Importação concluída: ${results.filter(r => r.success).length}/${results.length} sucessos`);
      return results;

    } catch (error) {
      console.error('❌ Erro na importação em lote:', error);
      throw new Error('Falha na importação em lote de entity types');
    }
  }

  /**
   * Exportar entity types
   */
  async exportEntityTypes() {
    try {
      console.log('📤 Exportando entity types');
      
      const entityTypes = await this.listEntityTypes();
      
      // Adicionar metadados do Firestore
      for (const entityType of entityTypes) {
        const metadata = await this.getEntityMetadata(entityType.name);
        if (metadata) {
          entityType.metadata = metadata;
        }
      }
      
      return entityTypes;

    } catch (error) {
      console.error('❌ Erro ao exportar entity types:', error);
      throw new Error('Falha ao exportar entity types');
    }
  }

  /**
   * Validar dados do entity type
   */
  validateEntityTypeData(entityTypeData) {
    const errors = [];
    
    if (!entityTypeData.displayName) {
      errors.push('Nome do entity type é obrigatório');
    }
    
    if (!entityTypeData.kind || !['KIND_MAP', 'KIND_LIST', 'KIND_REGEXP'].includes(entityTypeData.kind)) {
      errors.push('Kind deve ser KIND_MAP, KIND_LIST ou KIND_REGEXP');
    }
    
    if (entityTypeData.entities) {
      entityTypeData.entities.forEach((entity, index) => {
        if (!entity.value) {
          errors.push(`Entidade ${index + 1} não possui valor`);
        }
        
        if (entity.synonyms && !Array.isArray(entity.synonyms)) {
          errors.push(`Sinônimos da entidade ${index + 1} devem ser um array`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Buscar entity types por texto
   */
  async searchEntityTypes(searchText) {
    try {
      const entityTypes = await this.listEntityTypes();
      
      return entityTypes.filter(entityType => {
        // Buscar no nome do entity type
        if (entityType.displayName.toLowerCase().includes(searchText.toLowerCase())) {
          return true;
        }
        
        // Buscar nos valores das entidades
        return entityType.entities.some(entity => 
          entity.value.toLowerCase().includes(searchText.toLowerCase()) ||
          entity.synonyms.some(synonym => 
            synonym.toLowerCase().includes(searchText.toLowerCase())
          )
        );
      });

    } catch (error) {
      console.error('❌ Erro ao buscar entity types:', error);
      return [];
    }
  }

  /**
   * Obter estatísticas dos entity types
   */
  async getEntityTypeStatistics() {
    try {
      const entityTypes = await this.listEntityTypes();
      
      const stats = {
        totalEntityTypes: entityTypes.length,
        totalEntities: 0,
        avgEntitiesPerType: 0,
        typesByKind: {
          KIND_MAP: 0,
          KIND_LIST: 0,
          KIND_REGEXP: 0
        },
        fuzzyExtractionEnabled: 0,
        redactedTypes: 0,
        topEntityTypes: []
      };
      
      entityTypes.forEach(entityType => {
        stats.totalEntities += entityType.entities.length;
        stats.typesByKind[entityType.kind] = (stats.typesByKind[entityType.kind] || 0) + 1;
        
        if (entityType.enableFuzzyExtraction) {
          stats.fuzzyExtractionEnabled++;
        }
        
        if (entityType.redact) {
          stats.redactedTypes++;
        }
      });
      
      stats.avgEntitiesPerType = stats.totalEntityTypes > 0 
        ? Math.round((stats.totalEntities / stats.totalEntityTypes) * 100) / 100
        : 0;
      
      // Top entity types por número de entidades
      stats.topEntityTypes = entityTypes
        .sort((a, b) => b.entities.length - a.entities.length)
        .slice(0, 10)
        .map(entityType => ({
          displayName: entityType.displayName,
          entitiesCount: entityType.entities.length,
          kind: entityType.kind
        }));
      
      return stats;

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      throw new Error('Falha ao obter estatísticas dos entity types');
    }
  }

  /**
   * Criar entity types do sistema
   */
  async createSystemEntityTypes() {
    const systemEntityTypes = [
      {
        displayName: 'sys.person',
        kind: 'KIND_MAP',
        entities: [
          { value: 'João', synonyms: ['João', 'João Silva', 'Sr. João'] },
          { value: 'Maria', synonyms: ['Maria', 'Maria Santos', 'Sra. Maria'] },
          { value: 'Pedro', synonyms: ['Pedro', 'Pedro Costa', 'Sr. Pedro'] },
          { value: 'Ana', synonyms: ['Ana', 'Ana Oliveira', 'Sra. Ana'] }
        ],
        enableFuzzyExtraction: true,
        category: 'system',
        description: 'Nomes de pessoas comuns'
      },
      {
        displayName: 'sys.company',
        kind: 'KIND_MAP',
        entities: [
          { value: 'Google', synonyms: ['Google', 'Google Inc', 'Alphabet'] },
          { value: 'Microsoft', synonyms: ['Microsoft', 'Microsoft Corp', 'MSFT'] },
          { value: 'Apple', synonyms: ['Apple', 'Apple Inc', 'AAPL'] },
          { value: 'Amazon', synonyms: ['Amazon', 'AWS', 'Amazon Web Services'] }
        ],
        enableFuzzyExtraction: true,
        category: 'system',
        description: 'Empresas conhecidas'
      },
      {
        displayName: 'sys.product',
        kind: 'KIND_MAP',
        entities: [
          { value: 'chatbot', synonyms: ['chatbot', 'bot', 'assistente virtual', 'robô'] },
          { value: 'crm', synonyms: ['CRM', 'sistema de vendas', 'gestão de clientes'] },
          { value: 'automação', synonyms: ['automação', 'automatização', 'workflow'] }
        ],
        enableFuzzyExtraction: true,
        category: 'system',
        description: 'Produtos e serviços da empresa'
      }
    ];

    return this.batchImportEntityTypes(systemEntityTypes);
  }

  /**
   * Salvar metadata do entity type no Firestore
   */
  async saveEntityMetadata(entityTypeName, entityTypeData) {
    try {
      const metadata = {
        entityTypeName,
        displayName: entityTypeData.displayName,
        category: entityTypeData.category || 'general',
        description: entityTypeData.description || '',
        tags: entityTypeData.tags || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: entityTypeData.createdBy || 'system',
        version: '1.0.0'
      };
      
      await this.db.collection('entity_metadata').doc(this.getEntityTypeId(entityTypeName)).set(metadata);

    } catch (error) {
      console.error('❌ Erro ao salvar metadata do entity type:', error);
    }
  }

  /**
   * Obter metadata do entity type
   */
  async getEntityMetadata(entityTypeName) {
    try {
      const doc = await this.db.collection('entity_metadata').doc(this.getEntityTypeId(entityTypeName)).get();
      return doc.exists ? doc.data() : null;

    } catch (error) {
      console.error('❌ Erro ao obter metadata do entity type:', error);
      return null;
    }
  }

  /**
   * Atualizar metadata do entity type
   */
  async updateEntityMetadata(entityTypeName, updates) {
    try {
      await this.db.collection('entity_metadata').doc(this.getEntityTypeId(entityTypeName)).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar metadata do entity type:', error);
    }
  }

  /**
   * Deletar metadata do entity type
   */
  async deleteEntityMetadata(entityTypeName) {
    try {
      await this.db.collection('entity_metadata').doc(this.getEntityTypeId(entityTypeName)).delete();

    } catch (error) {
      console.error('❌ Erro ao deletar metadata do entity type:', error);
    }
  }

  /**
   * Extrair ID do entity type do nome completo
   */
  getEntityTypeId(entityTypeName) {
    return entityTypeName.split('/').pop();
  }
}

module.exports = EntityManager;