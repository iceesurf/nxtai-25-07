const fs = require('fs');
const csv = require('csv-parser');
const IntentManager = require('./IntentManager');

class IntentImporter {
  constructor(intentManager) {
    this.intentManager = intentManager;
  }

  /**
   * Importar intents de arquivo CSV
   */
  async importFromCSV(filePath) {
    try {
      console.log(`📁 Importando intents do arquivo: ${filePath}`);
      
      const intentsData = [];
      const intentMap = new Map();

      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            const intentName = row['Intent Name'] || row['intent_name'];
            const trainingPhrase = row['Training Phrase'] || row['training_phrase'];
            const category = row['Category'] || row['category'] || 'general';
            const description = row['Description'] || row['description'] || '';

            if (!intentName || !trainingPhrase) {
              console.warn('⚠️ Linha inválida no CSV:', row);
              return;
            }

            if (!intentMap.has(intentName)) {
              intentMap.set(intentName, {
                displayName: intentName,
                trainingPhrases: [],
                category,
                description,
                parameters: [],
                priority: parseInt(row['Priority'] || '500000'),
                isFallback: (row['Is Fallback'] || '').toLowerCase() === 'true',
                labels: {}
              });
            }

            intentMap.get(intentName).trainingPhrases.push(trainingPhrase);
          })
          .on('end', async () => {
            try {
              const intentsArray = Array.from(intentMap.values());
              console.log(`📊 ${intentsArray.length} intents únicos encontrados`);
              
              const results = await this.intentManager.batchImportIntents(intentsArray);
              resolve(results);

            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });

    } catch (error) {
      console.error('❌ Erro ao importar CSV:', error);
      throw new Error(`Falha ao importar intents do CSV: ${error.message}`);
    }
  }

  /**
   * Importar intents de arquivo JSON
   */
  async importFromJSON(filePath) {
    try {
      console.log(`📁 Importando intents do arquivo JSON: ${filePath}`);
      
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!Array.isArray(jsonData)) {
        throw new Error('Arquivo JSON deve conter um array de intents');
      }

      // Validar estrutura dos intents
      const validIntents = [];
      for (const intentData of jsonData) {
        const validation = this.intentManager.validateIntentData(intentData);
        if (validation.isValid) {
          validIntents.push(intentData);
        } else {
          console.warn(`⚠️ Intent inválido: ${intentData.displayName}`, validation.errors);
        }
      }

      console.log(`📊 ${validIntents.length}/${jsonData.length} intents válidos`);
      
      const results = await this.intentManager.batchImportIntents(validIntents);
      return results;

    } catch (error) {
      console.error('❌ Erro ao importar JSON:', error);
      throw new Error(`Falha ao importar intents do JSON: ${error.message}`);
    }
  }

  /**
   * Importar intents do backup do Dialogflow
   */
  async importFromDialogflowBackup(backupPath) {
    try {
      console.log(`🔄 Importando backup do Dialogflow: ${backupPath}`);
      
      // Assumindo estrutura padrão do backup do Dialogflow
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      if (!backupData.intents) {
        throw new Error('Backup não contém intents');
      }

      const intentsData = backupData.intents.map(intent => ({
        displayName: intent.displayName,
        trainingPhrases: intent.trainingPhrases?.map(phrase => 
          phrase.parts?.map(part => part.text).join(' ')
        ) || [],
        parameters: intent.parameters || [],
        priority: intent.priority || 500000,
        isFallback: intent.isFallback || false,
        labels: intent.labels || {},
        category: 'imported',
        description: `Importado do backup: ${intent.name}`
      }));

      const results = await this.intentManager.batchImportIntents(intentsData);
      return results;

    } catch (error) {
      console.error('❌ Erro ao importar backup:', error);
      throw new Error(`Falha ao importar backup do Dialogflow: ${error.message}`);
    }
  }

  /**
   * Validar arquivo antes da importação
   */
  validateImportFile(filePath, format) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Arquivo não encontrado');
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('Arquivo está vazio');
      }

      // Validar tamanho máximo (10MB)
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Arquivo muito grande (máximo 10MB)');
      }

      // Validar extensão
      const extension = filePath.split('.').pop().toLowerCase();
      const validExtensions = {
        'csv': ['csv'],
        'json': ['json'],
        'backup': ['json', 'zip']
      };

      if (!validExtensions[format] || !validExtensions[format].includes(extension)) {
        throw new Error(`Extensão inválida para formato ${format}: ${extension}`);
      }

      return { isValid: true };

    } catch (error) {
      return { 
        isValid: false, 
        error: error.message 
      };
    }
  }

  /**
   * Gerar template CSV para importação
   */
  generateCSVTemplate(outputPath) {
    try {
      const csvHeaders = [
        'Intent Name',
        'Training Phrase',
        'Category',
        'Description',
        'Priority',
        'Is Fallback'
      ];

      const sampleData = [
        {
          'Intent Name': 'greeting',
          'Training Phrase': 'olá',
          'Category': 'conversation',
          'Description': 'Saudação do usuário',
          'Priority': '500000',
          'Is Fallback': 'false'
        },
        {
          'Intent Name': 'greeting',
          'Training Phrase': 'oi',
          'Category': 'conversation',
          'Description': 'Saudação do usuário',
          'Priority': '500000',
          'Is Fallback': 'false'
        },
        {
          'Intent Name': 'goodbye',
          'Training Phrase': 'tchau',
          'Category': 'conversation',
          'Description': 'Despedida do usuário',
          'Priority': '500000',
          'Is Fallback': 'false'
        }
      ];

      const csvContent = [
        csvHeaders.join(','),
        ...sampleData.map(row => 
          csvHeaders.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      fs.writeFileSync(outputPath, csvContent);
      console.log(`✅ Template CSV criado: ${outputPath}`);

    } catch (error) {
      console.error('❌ Erro ao gerar template:', error);
      throw new Error(`Falha ao gerar template CSV: ${error.message}`);
    }
  }

  /**
   * Pré-visualizar importação sem executar
   */
  async previewImport(filePath, format) {
    try {
      console.log(`👀 Pré-visualizando importação: ${filePath}`);
      
      let intentsData = [];
      
      switch (format) {
        case 'csv':
          intentsData = await this.parseCSVPreview(filePath);
          break;
        case 'json':
          intentsData = await this.parseJSONPreview(filePath);
          break;
        default:
          throw new Error(`Formato não suportado: ${format}`);
      }

      const preview = {
        totalIntents: intentsData.length,
        validIntents: 0,
        invalidIntents: 0,
        errors: [],
        sample: []
      };

      for (const intentData of intentsData.slice(0, 10)) { // Preview dos primeiros 10
        const validation = this.intentManager.validateIntentData(intentData);
        
        if (validation.isValid) {
          preview.validIntents++;
          preview.sample.push({
            displayName: intentData.displayName,
            trainingPhrasesCount: intentData.trainingPhrases.length,
            status: 'valid'
          });
        } else {
          preview.invalidIntents++;
          preview.errors.push({
            displayName: intentData.displayName,
            errors: validation.errors
          });
          preview.sample.push({
            displayName: intentData.displayName,
            status: 'invalid',
            errors: validation.errors
          });
        }
      }

      return preview;

    } catch (error) {
      console.error('❌ Erro na pré-visualização:', error);
      throw new Error(`Falha na pré-visualização: ${error.message}`);
    }
  }

  async parseCSVPreview(filePath) {
    const intentsData = [];
    const intentMap = new Map();

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const intentName = row['Intent Name'] || row['intent_name'];
          const trainingPhrase = row['Training Phrase'] || row['training_phrase'];

          if (!intentName || !trainingPhrase) return;

          if (!intentMap.has(intentName)) {
            intentMap.set(intentName, {
              displayName: intentName,
              trainingPhrases: [],
              category: row['Category'] || 'general',
              description: row['Description'] || ''
            });
          }

          intentMap.get(intentName).trainingPhrases.push(trainingPhrase);
        })
        .on('end', () => {
          resolve(Array.from(intentMap.values()));
        })
        .on('error', reject);
    });
  }

  async parseJSONPreview(filePath) {
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(jsonData) ? jsonData : [];
  }
}

module.exports = IntentImporter;