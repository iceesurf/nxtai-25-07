const { SessionsClient, IntentsClient } = require('@google-cloud/dialogflow-cx');
const admin = require('firebase-admin');

class IntentManager {
  constructor(config) {
    this.projectId = config.projectId;
    this.location = config.location;
    this.agentId = config.agentId;
    this.intentsClient = new IntentsClient();
    this.sessionsClient = new SessionsClient();
    this.db = admin.firestore();
  }

  /**
   * Criar novo intent
   */
  async createIntent(intentData) {
    try {
      console.log(`🎯 Criando intent: ${intentData.displayName}`);
      
      const parent = this.intentsClient.agentPath(
        this.projectId,
        this.location,
        this.agentId
      );

      const trainingPhrases = intentData.trainingPhrases.map(phrase => ({
        parts: [{ text: phrase }],
        repeatCount: 1
      }));

      const parameters = intentData.parameters || [];

      const request = {
        parent,
        intent: {
          displayName: intentData.displayName,
          trainingPhrases,
          parameters,
          priority: intentData.priority || 500000,
          isFallback: intentData.isFallback || false,
          labels: intentData.labels || {}
        }
      };

      const [response] = await this.intentsClient.createIntent(request);
      
      // Salvar metadata no Firestore
      await this.saveIntentMetadata(response.name, intentData);
      
      console.log(`✅ Intent criado: ${response.name}`);
      return response.name;

    } catch (error) {
      console.error('❌ Erro ao criar intent:', error);
      throw new Error(`Falha ao criar intent: ${intentData.displayName}`);
    }
  }

  /**
   * Listar todos os intents
   */
  async listIntents() {
    try {
      const parent = this.intentsClient.agentPath(
        this.projectId,
        this.location,
        this.agentId
      );

      const [intents] = await this.intentsClient.listIntents({ parent });
      
      return intents.map(intent => ({
        name: intent.name,
        displayName: intent.displayName,
        trainingPhrases: intent.trainingPhrases?.map(phrase => ({
          parts: phrase.parts?.map(part => part.text).join(' ')
        })) || [],
        parameters: intent.parameters || [],
        priority: intent.priority,
        isFallback: intent.isFallback,
        labels: intent.labels
      }));

    } catch (error) {
      console.error('❌ Erro ao listar intents:', error);
      throw new Error('Falha ao listar intents');
    }
  }

  /**
   * Atualizar intent existente
   */
  async updateIntent(intentName, updates) {
    try {
      console.log(`🔄 Atualizando intent: ${intentName}`);
      
      const currentIntent = await this.getIntent(intentName);
      if (!currentIntent) {
        throw new Error(`Intent não encontrado: ${intentName}`);
      }

      const updatedIntent = { ...currentIntent, ...updates };
      
      const request = {
        intent: {
          name: intentName,
          displayName: updatedIntent.displayName,
          trainingPhrases: updatedIntent.trainingPhrases.map(phrase => ({
            parts: [{ text: phrase.parts }],
            repeatCount: 1
          })),
          parameters: updatedIntent.parameters,
          priority: updatedIntent.priority,
          isFallback: updatedIntent.isFallback,
          labels: updatedIntent.labels
        }
      };

      await this.intentsClient.updateIntent(request);
      
      // Atualizar metadata
      await this.updateIntentMetadata(intentName, updates);
      
      console.log(`✅ Intent atualizado: ${intentName}`);

    } catch (error) {
      console.error('❌ Erro ao atualizar intent:', error);
      throw new Error(`Falha ao atualizar intent: ${intentName}`);
    }
  }

  /**
   * Deletar intent
   */
  async deleteIntent(intentName) {
    try {
      console.log(`🗑️ Deletando intent: ${intentName}`);
      
      await this.intentsClient.deleteIntent({ name: intentName });
      
      // Remover metadata
      await this.deleteIntentMetadata(intentName);
      
      console.log(`✅ Intent deletado: ${intentName}`);

    } catch (error) {
      console.error('❌ Erro ao deletar intent:', error);
      throw new Error(`Falha ao deletar intent: ${intentName}`);
    }
  }

  /**
   * Obter intent específico
   */
  async getIntent(intentName) {
    try {
      const [response] = await this.intentsClient.getIntent({ name: intentName });
      
      return {
        name: response.name,
        displayName: response.displayName,
        trainingPhrases: response.trainingPhrases?.map(phrase => ({
          parts: phrase.parts?.map(part => part.text).join(' ')
        })) || [],
        parameters: response.parameters || [],
        priority: response.priority,
        isFallback: response.isFallback,
        labels: response.labels
      };

    } catch (error) {
      console.error('❌ Erro ao obter intent:', error);
      return null;
    }
  }

  /**
   * Importar intents em lote
   */
  async batchImportIntents(intentsData) {
    try {
      console.log(`📥 Importando ${intentsData.length} intents`);
      
      const results = [];
      
      for (const intentData of intentsData) {
        try {
          const intentName = await this.createIntent(intentData);
          results.push({ success: true, intentName, displayName: intentData.displayName });
        } catch (error) {
          console.error(`❌ Falha ao importar intent ${intentData.displayName}:`, error);
          results.push({ success: false, error: error.message, displayName: intentData.displayName });
        }
      }
      
      console.log(`✅ Importação concluída: ${results.filter(r => r.success).length}/${results.length} sucessos`);
      return results;

    } catch (error) {
      console.error('❌ Erro na importação em lote:', error);
      throw new Error('Falha na importação em lote de intents');
    }
  }

  /**
   * Exportar intents
   */
  async exportIntents() {
    try {
      console.log('📤 Exportando intents');
      
      const intents = await this.listIntents();
      
      // Adicionar metadados do Firestore
      for (const intent of intents) {
        const metadata = await this.getIntentMetadata(intent.name);
        if (metadata) {
          intent.metadata = metadata;
        }
      }
      
      return intents;

    } catch (error) {
      console.error('❌ Erro ao exportar intents:', error);
      throw new Error('Falha ao exportar intents');
    }
  }

  /**
   * Validar dados do intent
   */
  validateIntentData(intentData) {
    const errors = [];
    
    if (!intentData.displayName) {
      errors.push('Nome do intent é obrigatório');
    }
    
    if (!intentData.trainingPhrases || intentData.trainingPhrases.length === 0) {
      errors.push('Pelo menos uma frase de treinamento é obrigatória');
    }
    
    if (intentData.trainingPhrases) {
      intentData.trainingPhrases.forEach((phrase, index) => {
        if (!phrase || phrase.trim().length === 0) {
          errors.push(`Frase de treinamento ${index + 1} está vazia`);
        }
        
        if (phrase.length < 3) {
          errors.push(`Frase de treinamento ${index + 1} é muito curta`);
        }
        
        if (phrase.length > 200) {
          errors.push(`Frase de treinamento ${index + 1} é muito longa`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Buscar intents por texto
   */
  async searchIntents(searchText) {
    try {
      const intents = await this.listIntents();
      
      return intents.filter(intent => {
        // Buscar no nome do intent
        if (intent.displayName.toLowerCase().includes(searchText.toLowerCase())) {
          return true;
        }
        
        // Buscar nas frases de treinamento
        return intent.trainingPhrases.some(phrase => 
          phrase.parts.toLowerCase().includes(searchText.toLowerCase())
        );
      });

    } catch (error) {
      console.error('❌ Erro ao buscar intents:', error);
      return [];
    }
  }

  /**
   * Obter estatísticas dos intents
   */
  async getIntentStatistics() {
    try {
      const intents = await this.listIntents();
      
      const stats = {
        totalIntents: intents.length,
        totalTrainingPhrases: 0,
        avgPhrasesPerIntent: 0,
        intentsByPriority: {},
        fallbackIntents: 0,
        parametricIntents: 0
      };
      
      intents.forEach(intent => {
        stats.totalTrainingPhrases += intent.trainingPhrases.length;
        
        const priority = intent.priority || 500000;
        stats.intentsByPriority[priority] = (stats.intentsByPriority[priority] || 0) + 1;
        
        if (intent.isFallback) {
          stats.fallbackIntents++;
        }
        
        if (intent.parameters && intent.parameters.length > 0) {
          stats.parametricIntents++;
        }
      });
      
      stats.avgPhrasesPerIntent = stats.totalIntents > 0 
        ? Math.round((stats.totalTrainingPhrases / stats.totalIntents) * 100) / 100
        : 0;
      
      return stats;

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      throw new Error('Falha ao obter estatísticas dos intents');
    }
  }

  /**
   * Salvar metadata do intent no Firestore
   */
  async saveIntentMetadata(intentName, intentData) {
    try {
      const metadata = {
        intentName,
        displayName: intentData.displayName,
        category: intentData.category || 'general',
        description: intentData.description || '',
        tags: intentData.tags || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: intentData.createdBy || 'system',
        version: '1.0.0'
      };
      
      await this.db.collection('intent_metadata').doc(this.getIntentId(intentName)).set(metadata);

    } catch (error) {
      console.error('❌ Erro ao salvar metadata do intent:', error);
    }
  }

  /**
   * Obter metadata do intent
   */
  async getIntentMetadata(intentName) {
    try {
      const doc = await this.db.collection('intent_metadata').doc(this.getIntentId(intentName)).get();
      return doc.exists ? doc.data() : null;

    } catch (error) {
      console.error('❌ Erro ao obter metadata do intent:', error);
      return null;
    }
  }

  /**
   * Atualizar metadata do intent
   */
  async updateIntentMetadata(intentName, updates) {
    try {
      await this.db.collection('intent_metadata').doc(this.getIntentId(intentName)).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar metadata do intent:', error);
    }
  }

  /**
   * Deletar metadata do intent
   */
  async deleteIntentMetadata(intentName) {
    try {
      await this.db.collection('intent_metadata').doc(this.getIntentId(intentName)).delete();

    } catch (error) {
      console.error('❌ Erro ao deletar metadata do intent:', error);
    }
  }

  /**
   * Extrair ID do intent do nome completo
   */
  getIntentId(intentName) {
    return intentName.split('/').pop();
  }

  /**
   * Testar intent com frase
   */
  async testIntent(phrase, sessionId = null) {
    try {
      if (!sessionId) {
        sessionId = `test-session-${Date.now()}`;
      }
      
      const sessionPath = this.sessionsClient.projectLocationAgentSessionPath(
        this.projectId,
        this.location,
        this.agentId,
        sessionId
      );

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: phrase
          },
          languageCode: 'pt-br'
        }
      };

      const [response] = await this.sessionsClient.detectIntent(request);
      const result = response.queryResult;

      return {
        intent: result?.match?.intent?.displayName || 'Default Fallback Intent',
        confidence: result?.match?.confidence || 0,
        parameters: result?.parameters || {},
        responseText: result?.responseMessages?.[0]?.text?.text?.[0] || '',
        sessionId
      };

    } catch (error) {
      console.error('❌ Erro ao testar intent:', error);
      throw new Error('Falha ao testar intent');
    }
  }
}

module.exports = IntentManager;