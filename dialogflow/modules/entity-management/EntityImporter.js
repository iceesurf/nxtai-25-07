const fs = require('fs');
const csv = require('csv-parser');
const EntityManager = require('./EntityManager');

class EntityImporter {
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  /**
   * Importar entity types de arquivo CSV
   */
  async importFromCSV(filePath) {
    try {
      console.log(`📁 Importando entity types do arquivo CSV: ${filePath}`);
      
      const entityTypesData = [];
      const entityTypeMap = new Map();

      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            const entityTypeName = row['Entity Type'] || row['entity_type'];
            const entityValue = row['Entity Value'] || row['entity_value'];
            const synonyms = (row['Synonyms'] || row['synonyms'] || '').split(';').filter(s => s.trim());
            const kind = row['Kind'] || row['kind'] || 'KIND_MAP';
            const category = row['Category'] || row['category'] || 'general';

            if (!entityTypeName || !entityValue) {
              console.warn('⚠️ Linha inválida no CSV:', row);
              return;
            }

            if (!entityTypeMap.has(entityTypeName)) {
              entityTypeMap.set(entityTypeName, {
                displayName: entityTypeName,
                kind,
                entities: [],
                category,
                description: row['Description'] || '',
                enableFuzzyExtraction: (row['Fuzzy Extraction'] || '').toLowerCase() === 'true',
                redact: (row['Redact'] || '').toLowerCase() === 'true'
              });
            }

            const entityType = entityTypeMap.get(entityTypeName);
            entityType.entities.push({
              value: entityValue,
              synonyms: synonyms.length > 0 ? synonyms : [entityValue]
            });
          })
          .on('end', async () => {
            try {
              const entityTypesArray = Array.from(entityTypeMap.values());
              console.log(`📊 ${entityTypesArray.length} entity types únicos encontrados`);
              
              const results = await this.entityManager.batchImportEntityTypes(entityTypesArray);
              resolve(results);

            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });

    } catch (error) {
      console.error('❌ Erro ao importar CSV:', error);
      throw new Error(`Falha ao importar entity types do CSV: ${error.message}`);
    }
  }

  /**
   * Importar entity types de arquivo JSON
   */
  async importFromJSON(filePath) {
    try {
      console.log(`📁 Importando entity types do arquivo JSON: ${filePath}`);
      
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!Array.isArray(jsonData)) {
        throw new Error('Arquivo JSON deve conter um array de entity types');
      }

      // Validar estrutura dos entity types
      const validEntityTypes = [];
      for (const entityTypeData of jsonData) {
        const validation = this.entityManager.validateEntityTypeData(entityTypeData);
        if (validation.isValid) {
          validEntityTypes.push(entityTypeData);
        } else {
          console.warn(`⚠️ Entity type inválido: ${entityTypeData.displayName}`, validation.errors);
        }
      }

      console.log(`📊 ${validEntityTypes.length}/${jsonData.length} entity types válidos`);
      
      const results = await this.entityManager.batchImportEntityTypes(validEntityTypes);
      return results;

    } catch (error) {
      console.error('❌ Erro ao importar JSON:', error);
      throw new Error(`Falha ao importar entity types do JSON: ${error.message}`);
    }
  }

  /**
   * Importar entity types de backup do Dialogflow
   */
  async importFromDialogflowBackup(backupPath) {
    try {
      console.log(`🔄 Importando backup do Dialogflow: ${backupPath}`);
      
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      if (!backupData.entityTypes && !backupData.entities) {
        throw new Error('Backup não contém entity types');
      }

      const entityTypesSource = backupData.entityTypes || backupData.entities;
      
      const entityTypesData = entityTypesSource.map(entityType => ({
        displayName: entityType.displayName || entityType.name,
        kind: entityType.kind || 'KIND_MAP',
        entities: entityType.entities?.map(entity => ({
          value: entity.value,
          synonyms: entity.synonyms || [entity.value]
        })) || [],
        enableFuzzyExtraction: entityType.enableFuzzyExtraction || false,
        redact: entityType.redact || false,
        category: 'imported',
        description: `Importado do backup: ${entityType.name || entityType.displayName}`
      }));

      const results = await this.entityManager.batchImportEntityTypes(entityTypesData);
      return results;

    } catch (error) {
      console.error('❌ Erro ao importar backup:', error);
      throw new Error(`Falha ao importar backup do Dialogflow: ${error.message}`);
    }
  }

  /**
   * Importar entidades para entity type existente
   */
  async importEntitiesToExistingType(entityTypeName, entitiesData) {
    try {
      console.log(`➕ Importando entidades para entity type: ${entityTypeName}`);
      
      const entities = entitiesData.map(entity => ({
        value: entity.value,
        synonyms: entity.synonyms || [entity.value]
      }));

      await this.entityManager.addEntities(entityTypeName, entities);
      
      console.log(`✅ ${entities.length} entidades importadas para ${entityTypeName}`);
      return { success: true, entitiesCount: entities.length };

    } catch (error) {
      console.error('❌ Erro ao importar entidades:', error);
      throw new Error(`Falha ao importar entidades para ${entityTypeName}: ${error.message}`);
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

      // Validar tamanho máximo (50MB para entity types)
      if (stats.size > 50 * 1024 * 1024) {
        throw new Error('Arquivo muito grande (máximo 50MB)');
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
        'Entity Type',
        'Entity Value',
        'Synonyms',
        'Kind',
        'Category',
        'Description',
        'Fuzzy Extraction',
        'Redact'
      ];

      const sampleData = [
        {
          'Entity Type': 'color',
          'Entity Value': 'azul',
          'Synonyms': 'azul;blue;celeste',
          'Kind': 'KIND_MAP',
          'Category': 'attributes',
          'Description': 'Cores disponíveis',
          'Fuzzy Extraction': 'true',
          'Redact': 'false'
        },
        {
          'Entity Type': 'color',
          'Entity Value': 'vermelho',
          'Synonyms': 'vermelho;red;rubro',
          'Kind': 'KIND_MAP',
          'Category': 'attributes',
          'Description': 'Cores disponíveis',
          'Fuzzy Extraction': 'true',
          'Redact': 'false'
        },
        {
          'Entity Type': 'size',
          'Entity Value': 'pequeno',
          'Synonyms': 'pequeno;small;P',
          'Kind': 'KIND_MAP',
          'Category': 'attributes',
          'Description': 'Tamanhos disponíveis',
          'Fuzzy Extraction': 'true',
          'Redact': 'false'
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
      
      let entityTypesData = [];
      
      switch (format) {
        case 'csv':
          entityTypesData = await this.parseCSVPreview(filePath);
          break;
        case 'json':
          entityTypesData = await this.parseJSONPreview(filePath);
          break;
        default:
          throw new Error(`Formato não suportado: ${format}`);
      }

      const preview = {
        totalEntityTypes: entityTypesData.length,
        validEntityTypes: 0,
        invalidEntityTypes: 0,
        totalEntities: 0,
        errors: [],
        sample: []
      };

      for (const entityTypeData of entityTypesData.slice(0, 10)) { // Preview dos primeiros 10
        const validation = this.entityManager.validateEntityTypeData(entityTypeData);
        
        if (validation.isValid) {
          preview.validEntityTypes++;
          preview.totalEntities += entityTypeData.entities?.length || 0;
          preview.sample.push({
            displayName: entityTypeData.displayName,
            entitiesCount: entityTypeData.entities?.length || 0,
            kind: entityTypeData.kind,
            status: 'valid'
          });
        } else {
          preview.invalidEntityTypes++;
          preview.errors.push({
            displayName: entityTypeData.displayName,
            errors: validation.errors
          });
          preview.sample.push({
            displayName: entityTypeData.displayName,
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
    const entityTypesData = [];
    const entityTypeMap = new Map();

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const entityTypeName = row['Entity Type'] || row['entity_type'];
          const entityValue = row['Entity Value'] || row['entity_value'];

          if (!entityTypeName || !entityValue) return;

          if (!entityTypeMap.has(entityTypeName)) {
            entityTypeMap.set(entityTypeName, {
              displayName: entityTypeName,
              kind: row['Kind'] || 'KIND_MAP',
              entities: [],
              category: row['Category'] || 'general'
            });
          }

          entityTypeMap.get(entityTypeName).entities.push({
            value: entityValue,
            synonyms: (row['Synonyms'] || '').split(';').filter(s => s.trim())
          });
        })
        .on('end', () => {
          resolve(Array.from(entityTypeMap.values()));
        })
        .on('error', reject);
    });
  }

  async parseJSONPreview(filePath) {
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(jsonData) ? jsonData : [];
  }

  /**
   * Importar sinônimos massivamente
   */
  async bulkImportSynonyms(filePath) {
    try {
      console.log(`📁 Importação em massa de sinônimos: ${filePath}`);
      
      const synonymsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const results = [];

      for (const [entityTypeName, synonymsMap] of Object.entries(synonymsData)) {
        try {
          const entityType = await this.entityManager.getEntityType(entityTypeName);
          if (!entityType) {
            results.push({
              entityType: entityTypeName,
              success: false,
              error: 'Entity type não encontrado'
            });
            continue;
          }

          // Atualizar sinônimos das entidades existentes
          const updatedEntities = entityType.entities.map(entity => {
            if (synonymsMap[entity.value]) {
              const newSynonyms = [...new Set([...entity.synonyms, ...synonymsMap[entity.value]])];
              return { ...entity, synonyms: newSynonyms };
            }
            return entity;
          });

          await this.entityManager.updateEntityType(entityTypeName, { entities: updatedEntities });
          
          results.push({
            entityType: entityTypeName,
            success: true,
            synonymsAdded: Object.keys(synonymsMap).length
          });

        } catch (error) {
          results.push({
            entityType: entityTypeName,
            success: false,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error('❌ Erro na importação de sinônimos:', error);
      throw new Error(`Falha na importação de sinônimos: ${error.message}`);
    }
  }
}

module.exports = EntityImporter;