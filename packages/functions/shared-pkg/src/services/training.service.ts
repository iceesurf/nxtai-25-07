import * as admin from 'firebase-admin';
import { IntentService, Intent, TrainingPhrase } from './intent.service';
import { EntityService, EntityType } from './entity.service';

export interface TrainingData {
  id?: string;
  intentName: string;
  trainingPhrases: string[];
  parameters?: { [key: string]: any };
  entities?: string[];
  language: string;
  source: 'manual' | 'import' | 'generated' | 'user_conversation';
  createdAt?: Date;
  updatedAt?: Date;
  validated?: boolean;
  confidence?: number;
}

export interface TrainingBatch {
  id?: string;
  name: string;
  description?: string;
  data: TrainingData[];
  status: 'pending' | 'training' | 'completed' | 'failed';
  progress?: number;
  createdAt?: Date;
  completedAt?: Date;
  metrics?: TrainingMetrics;
}

export interface TrainingMetrics {
  totalPhrases: number;
  successfulPhrases: number;
  failedPhrases: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class TrainingService {
  private db: admin.firestore.Firestore;
  private intentService: IntentService;
  private entityService: EntityService;

  constructor(intentService: IntentService, entityService: EntityService) {
    this.db = admin.firestore();
    this.intentService = intentService;
    this.entityService = entityService;
  }

  async addTrainingData(data: TrainingData): Promise<string> {
    try {
      const trainingData = {
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        validated: false
      };

      const docRef = await this.db.collection('training_data').add(trainingData);
      console.log(`✅ Training data added: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error adding training data:', error);
      throw new Error('Failed to add training data');
    }
  }

  async getTrainingData(intentName?: string, language?: string): Promise<TrainingData[]> {
    try {
      let query = this.db.collection('training_data') as admin.firestore.Query;

      if (intentName) {
        query = query.where('intentName', '==', intentName);
      }

      if (language) {
        query = query.where('language', '==', language);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          intentName: data.intentName,
          trainingPhrases: data.trainingPhrases,
          parameters: data.parameters,
          entities: data.entities,
          language: data.language,
          source: data.source,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          validated: data.validated,
          confidence: data.confidence
        };
      });

    } catch (error) {
      console.error('❌ Error getting training data:', error);
      return [];
    }
  }

  async validateTrainingData(data: TrainingData): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validação básica
    if (!data.intentName) {
      errors.push('Intent name is required');
    }

    if (!data.trainingPhrases || data.trainingPhrases.length === 0) {
      errors.push('At least one training phrase is required');
    }

    if (!data.language) {
      errors.push('Language is required');
    }

    // Validar frases de treinamento
    if (data.trainingPhrases) {
      data.trainingPhrases.forEach((phrase, index) => {
        if (!phrase || phrase.trim().length === 0) {
          errors.push(`Training phrase ${index + 1} is empty`);
        }

        if (phrase.length < 3) {
          warnings.push(`Training phrase ${index + 1} is very short: "${phrase}"`);
        }

        if (phrase.length > 200) {
          warnings.push(`Training phrase ${index + 1} is very long: "${phrase.substring(0, 50)}..."`);
        }

        // Verificar duplicatas
        const duplicates = data.trainingPhrases.filter(p => p === phrase);
        if (duplicates.length > 1) {
          warnings.push(`Duplicate training phrase found: "${phrase}"`);
        }
      });

      // Sugestões
      if (data.trainingPhrases.length < 5) {
        suggestions.push('Consider adding more training phrases for better accuracy (recommended: 10-20)');
      }

      if (data.trainingPhrases.length > 50) {
        suggestions.push('Large number of training phrases detected. Consider using entity types for variations');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  async createTrainingBatch(batch: TrainingBatch): Promise<string> {
    try {
      const batchData = {
        ...batch,
        status: 'pending',
        progress: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('training_batches').add(batchData);
      console.log(`✅ Training batch created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating training batch:', error);
      throw new Error('Failed to create training batch');
    }
  }

  async processTrainingBatch(batchId: string): Promise<void> {
    try {
      console.log(`🔄 Processing training batch: ${batchId}`);
      
      // Atualizar status para 'training'
      await this.db.collection('training_batches').doc(batchId).update({
        status: 'training',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const batchDoc = await this.db.collection('training_batches').doc(batchId).get();
      const batch = batchDoc.data() as TrainingBatch;

      if (!batch) {
        throw new Error(`Training batch not found: ${batchId}`);
      }

      const metrics: TrainingMetrics = {
        totalPhrases: 0,
        successfulPhrases: 0,
        failedPhrases: 0
      };

      // Processar cada item de treinamento
      for (let i = 0; i < batch.data.length; i++) {
        const trainingData = batch.data[i];
        
        try {
          // Validar dados
          const validation = await this.validateTrainingData(trainingData);
          if (!validation.isValid) {
            console.warn(`⚠️ Invalid training data for intent ${trainingData.intentName}:`, validation.errors);
            metrics.failedPhrases += trainingData.trainingPhrases.length;
            continue;
          }

          // Aplicar treinamento
          await this.applyTrainingData(trainingData);
          metrics.successfulPhrases += trainingData.trainingPhrases.length;

        } catch (error) {
          console.error(`❌ Error processing training data for intent ${trainingData.intentName}:`, error);
          metrics.failedPhrases += trainingData.trainingPhrases.length;
        }

        metrics.totalPhrases += trainingData.trainingPhrases.length;

        // Atualizar progresso
        const progress = Math.round(((i + 1) / batch.data.length) * 100);
        await this.db.collection('training_batches').doc(batchId).update({
          progress,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Calcular métricas finais
      metrics.accuracy = metrics.totalPhrases > 0 
        ? metrics.successfulPhrases / metrics.totalPhrases 
        : 0;

      // Atualizar status final
      await this.db.collection('training_batches').doc(batchId).update({
        status: 'completed',
        progress: 100,
        metrics,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Training batch completed: ${batchId}`);

    } catch (error) {
      console.error('❌ Error processing training batch:', error);
      
      // Atualizar status para 'failed'
      await this.db.collection('training_batches').doc(batchId).update({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  }

  private async applyTrainingData(data: TrainingData): Promise<void> {
    try {
      // Verificar se o intent existe
      const intents = await this.intentService.listIntents();
      let existingIntent = intents.find(intent => 
        intent.displayName === data.intentName
      );

      if (existingIntent) {
        // Adicionar novas frases de treinamento ao intent existente
        const newTrainingPhrases: TrainingPhrase[] = data.trainingPhrases.map(phrase => ({
          parts: [{ text: phrase }]
        }));

        const updatedIntent = {
          ...existingIntent,
          trainingPhrases: [...existingIntent.trainingPhrases, ...newTrainingPhrases]
        };

        await this.intentService.updateIntent(existingIntent.name!, updatedIntent);

      } else {
        // Criar novo intent
        const newIntent: Intent = {
          name: '',
          displayName: data.intentName,
          trainingPhrases: data.trainingPhrases.map(phrase => ({
            parts: [{ text: phrase }]
          })),
          parameters: []
        };

        await this.intentService.createIntent(newIntent);
      }

      // Marcar dados como aplicados
      if (data.id) {
        await this.db.collection('training_data').doc(data.id).update({
          validated: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

    } catch (error) {
      console.error('❌ Error applying training data:', error);
      throw error;
    }
  }

  async importTrainingDataFromCSV(csvContent: string, intentName: string, language: string = 'pt-br'): Promise<string> {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
      const trainingPhrases = lines.map(line => line.trim().replace(/"/g, ''));

      const trainingData: TrainingData = {
        intentName,
        trainingPhrases,
        language,
        source: 'import'
      };

      return await this.addTrainingData(trainingData);

    } catch (error) {
      console.error('❌ Error importing training data from CSV:', error);
      throw new Error('Failed to import training data from CSV');
    }
  }

  async exportTrainingDataToCSV(intentName?: string, language?: string): Promise<string> {
    try {
      const trainingData = await this.getTrainingData(intentName, language);
      
      let csvContent = 'Intent,Training Phrase,Language,Source,Validated\n';
      
      trainingData.forEach(data => {
        data.trainingPhrases.forEach(phrase => {
          csvContent += `"${data.intentName}","${phrase}","${data.language}","${data.source}","${data.validated}"\n`;
        });
      });

      return csvContent;

    } catch (error) {
      console.error('❌ Error exporting training data to CSV:', error);
      throw new Error('Failed to export training data to CSV');
    }
  }

  async generateTrainingPhrases(intentName: string, basePhrase: string, variations: number = 5): Promise<string[]> {
    // Implementação simples de geração de variações
    // Em um cenário real, você poderia usar um modelo de linguagem mais avançado
    
    const variations_list: string[] = [basePhrase];
    
    // Exemplos de variações simples
    const synonyms: { [key: string]: string[] } = {
      'quero': ['desejo', 'gostaria', 'preciso'],
      'informações': ['dados', 'detalhes', 'info'],
      'ajuda': ['auxílio', 'suporte', 'assistência'],
      'produto': ['serviço', 'solução', 'oferta'],
      'empresa': ['organização', 'companhia', 'negócio']
    };

    // Gerar variações baseadas em sinônimos
    Object.entries(synonyms).forEach(([word, syns]) => {
      if (basePhrase.toLowerCase().includes(word)) {
        syns.forEach(synonym => {
          if (variations_list.length < variations) {
            const variation = basePhrase.toLowerCase().replace(word, synonym);
            variations_list.push(variation);
          }
        });
      }
    });

    // Gerar variações com diferentes estruturas
    const structures = [
      (phrase: string) => `Você pode me ${phrase}?`,
      (phrase: string) => `Gostaria de ${phrase}`,
      (phrase: string) => `Preciso de ${phrase}`,
      (phrase: string) => `Como posso ${phrase}?`
    ];

    structures.forEach(structure => {
      if (variations_list.length < variations) {
        variations_list.push(structure(basePhrase.toLowerCase()));
      }
    });

    return variations_list.slice(0, variations);
  }

  async analyzeConversationLogs(sessionIds: string[]): Promise<TrainingData[]> {
    try {
      const suggestions: TrainingData[] = [];

      for (const sessionId of sessionIds) {
        // Buscar conversas que não foram reconhecidas corretamente
        const conversationSnapshot = await this.db
          .collection('sessions')
          .doc(sessionId)
          .collection('conversation')
          .where('confidence', '<', 0.7)
          .get();

        conversationSnapshot.docs.forEach(doc => {
          const data = doc.data();
          
          suggestions.push({
            intentName: data.intent || 'unknown',
            trainingPhrases: [data.userInput],
            language: 'pt-br',
            source: 'user_conversation',
            confidence: data.confidence
          });
        });
      }

      return suggestions;

    } catch (error) {
      console.error('❌ Error analyzing conversation logs:', error);
      return [];
    }
  }

  async getTrainingStatistics(): Promise<{
    totalIntents: number;
    totalTrainingPhrases: number;
    averagePhrasesPerIntent: number;
    languageDistribution: { [key: string]: number };
    sourceDistribution: { [key: string]: number };
  }> {
    try {
      const trainingData = await this.getTrainingData();
      
      const intentCounts: { [key: string]: number } = {};
      const languageCounts: { [key: string]: number } = {};
      const sourceCounts: { [key: string]: number } = {};
      
      let totalPhrases = 0;

      trainingData.forEach(data => {
        intentCounts[data.intentName] = (intentCounts[data.intentName] || 0) + data.trainingPhrases.length;
        languageCounts[data.language] = (languageCounts[data.language] || 0) + data.trainingPhrases.length;
        sourceCounts[data.source] = (sourceCounts[data.source] || 0) + data.trainingPhrases.length;
        totalPhrases += data.trainingPhrases.length;
      });

      const totalIntents = Object.keys(intentCounts).length;
      const averagePhrasesPerIntent = totalIntents > 0 ? totalPhrases / totalIntents : 0;

      return {
        totalIntents,
        totalTrainingPhrases: totalPhrases,
        averagePhrasesPerIntent: Math.round(averagePhrasesPerIntent * 100) / 100,
        languageDistribution: languageCounts,
        sourceDistribution: sourceCounts
      };

    } catch (error) {
      console.error('❌ Error getting training statistics:', error);
      throw new Error('Failed to get training statistics');
    }
  }
}