const fs = require('fs');
const IntentManager = require('./IntentManager');

class IntentExporter {
  constructor(intentManager) {
    this.intentManager = intentManager;
  }

  /**
   * Exportar intents para CSV
   */
  async exportToCSV(outputPath, options = {}) {
    try {
      console.log(`📤 Exportando intents para CSV: ${outputPath}`);
      
      const intents = await this.intentManager.listIntents();
      const filteredIntents = this.applyFilters(intents, options.filters);

      const csvHeaders = [
        'Intent Name',
        'Training Phrase',
        'Category',
        'Description',
        'Priority',
        'Is Fallback',
        'Parameters',
        'Created At',
        'Updated At'
      ];

      const csvRows = [csvHeaders.join(',')];

      for (const intent of filteredIntents) {
        const metadata = await this.intentManager.getIntentMetadata(intent.name);
        
        for (const phrase of intent.trainingPhrases) {
          const row = [
            `"${intent.displayName}"`,
            `"${phrase.parts}"`,
            `"${metadata?.category || 'general'}"`,
            `"${metadata?.description || ''}"`,
            `"${intent.priority || 500000}"`,
            `"${intent.isFallback || false}"`,
            `"${intent.parameters?.map(p => p.id).join(';') || ''}"`,
            `"${metadata?.createdAt?.toDate?.()?.toISOString() || ''}"`,
            `"${metadata?.updatedAt?.toDate?.()?.toISOString() || ''}"`
          ];
          csvRows.push(row.join(','));
        }
      }

      const csvContent = csvRows.join('\n');
      fs.writeFileSync(outputPath, csvContent);
      
      console.log(`✅ Exportado ${filteredIntents.length} intents para CSV`);
      return {
        success: true,
        intentsCount: filteredIntents.length,
        filePath: outputPath,
        fileSize: csvContent.length
      };

    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      throw new Error(`Falha ao exportar para CSV: ${error.message}`);
    }
  }

  /**
   * Exportar intents para JSON
   */
  async exportToJSON(outputPath, options = {}) {
    try {
      console.log(`📤 Exportando intents para JSON: ${outputPath}`);
      
      const intents = await this.intentManager.listIntents();
      const filteredIntents = this.applyFilters(intents, options.filters);

      // Enriquecer com metadata
      const enrichedIntents = [];
      for (const intent of filteredIntents) {
        const metadata = await this.intentManager.getIntentMetadata(intent.name);
        
        enrichedIntents.push({
          ...intent,
          metadata: metadata || {},
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        });
      }

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          totalIntents: enrichedIntents.length,
          version: '1.0.0',
          source: 'dialogflow-cx',
          filters: options.filters || {}
        },
        intents: enrichedIntents
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(outputPath, jsonContent);
      
      console.log(`✅ Exportado ${enrichedIntents.length} intents para JSON`);
      return {
        success: true,
        intentsCount: enrichedIntents.length,
        filePath: outputPath,
        fileSize: jsonContent.length
      };

    } catch (error) {
      console.error('❌ Erro ao exportar JSON:', error);
      throw new Error(`Falha ao exportar para JSON: ${error.message}`);
    }
  }

  /**
   * Exportar intents para formato do Dialogflow
   */
  async exportToDialogflowFormat(outputPath, options = {}) {
    try {
      console.log(`📤 Exportando para formato Dialogflow: ${outputPath}`);
      
      const intents = await this.intentManager.listIntents();
      const filteredIntents = this.applyFilters(intents, options.filters);

      const dialogflowExport = {
        version: '1.0.0',
        kind: 'dialogflow#agent',
        timestamp: new Date().toISOString(),
        language: 'pt-br',
        intents: filteredIntents.map(intent => ({
          id: this.intentManager.getIntentId(intent.name),
          name: intent.displayName,
          auto: true,
          contexts: [],
          responses: [
            {
              resetContexts: false,
              affectedContexts: [],
              parameters: intent.parameters || [],
              messages: [
                {
                  type: 0,
                  speech: []
                }
              ],
              defaultResponsePlatforms: {},
              speech: []
            }
          ],
          priority: intent.priority || 500000,
          webhookUsed: false,
          webhookForSlotFilling: false,
          fallbackIntent: intent.isFallback || false,
          events: [],
          userSays: intent.trainingPhrases.map((phrase, index) => ({
            id: `phrase-${index}`,
            data: [
              {
                text: phrase.parts,
                userDefined: false
              }
            ],
            isTemplate: false,
            count: 0,
            updated: 0
          }))
        }))
      };

      const jsonContent = JSON.stringify(dialogflowExport, null, 2);
      fs.writeFileSync(outputPath, jsonContent);
      
      console.log(`✅ Exportado ${filteredIntents.length} intents para formato Dialogflow`);
      return {
        success: true,
        intentsCount: filteredIntents.length,
        filePath: outputPath,
        format: 'dialogflow',
        fileSize: jsonContent.length
      };

    } catch (error) {
      console.error('❌ Erro ao exportar formato Dialogflow:', error);
      throw new Error(`Falha ao exportar para formato Dialogflow: ${error.message}`);
    }
  }

  /**
   * Exportar relatório de intents
   */
  async exportReport(outputPath, options = {}) {
    try {
      console.log(`📊 Gerando relatório de intents: ${outputPath}`);
      
      const intents = await this.intentManager.listIntents();
      const stats = await this.intentManager.getIntentStatistics();
      
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          totalIntents: intents.length,
          version: '1.0.0'
        },
        statistics: stats,
        intentsByCategory: {},
        trainingPhraseDistribution: {},
        parameterUsage: {},
        recommendations: []
      };

      // Analisar por categoria
      for (const intent of intents) {
        const metadata = await this.intentManager.getIntentMetadata(intent.name);
        const category = metadata?.category || 'uncategorized';
        
        if (!report.intentsByCategory[category]) {
          report.intentsByCategory[category] = {
            count: 0,
            intents: []
          };
        }
        
        report.intentsByCategory[category].count++;
        report.intentsByCategory[category].intents.push({
          name: intent.displayName,
          trainingPhrasesCount: intent.trainingPhrases.length,
          parametersCount: intent.parameters?.length || 0
        });
      }

      // Distribuição de frases de treinamento
      intents.forEach(intent => {
        const count = intent.trainingPhrases.length;
        const range = this.getTrainingPhraseRange(count);
        
        if (!report.trainingPhraseDistribution[range]) {
          report.trainingPhraseDistribution[range] = 0;
        }
        report.trainingPhraseDistribution[range]++;
      });

      // Análise de parâmetros
      intents.forEach(intent => {
        intent.parameters?.forEach(param => {
          if (!report.parameterUsage[param.entityType]) {
            report.parameterUsage[param.entityType] = 0;
          }
          report.parameterUsage[param.entityType]++;
        });
      });

      // Gerar recomendações
      report.recommendations = this.generateRecommendations(intents, stats);

      const jsonContent = JSON.stringify(report, null, 2);
      fs.writeFileSync(outputPath, jsonContent);
      
      console.log(`✅ Relatório gerado: ${outputPath}`);
      return report;

    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      throw new Error(`Falha ao gerar relatório: ${error.message}`);
    }
  }

  /**
   * Aplicar filtros aos intents
   */
  applyFilters(intents, filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
      return intents;
    }

    return intents.filter(intent => {
      // Filtro por nome
      if (filters.name && !intent.displayName.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }

      // Filtro por categoria
      if (filters.category) {
        // Seria necessário buscar metadata, simplificado aqui
        return true;
      }

      // Filtro por prioridade
      if (filters.priority && intent.priority !== filters.priority) {
        return false;
      }

      // Filtro por fallback
      if (filters.isFallback !== undefined && intent.isFallback !== filters.isFallback) {
        return false;
      }

      // Filtro por número mínimo de frases de treinamento
      if (filters.minTrainingPhrases && intent.trainingPhrases.length < filters.minTrainingPhrases) {
        return false;
      }

      return true;
    });
  }

  /**
   * Determinar faixa de frases de treinamento
   */
  getTrainingPhraseRange(count) {
    if (count <= 5) return '1-5';
    if (count <= 10) return '6-10';
    if (count <= 20) return '11-20';
    if (count <= 50) return '21-50';
    return '50+';
  }

  /**
   * Gerar recomendações baseadas na análise
   */
  generateRecommendations(intents, stats) {
    const recommendations = [];

    // Recomendação sobre frases de treinamento
    if (stats.avgPhrasesPerIntent < 5) {
      recommendations.push({
        type: 'training_phrases',
        priority: 'high',
        message: 'Média de frases de treinamento muito baixa. Recomenda-se pelo menos 5-10 frases por intent.',
        action: 'Adicionar mais frases de treinamento aos intents'
      });
    }

    // Verificar intents sem parâmetros
    const intentsWithoutParams = intents.filter(intent => 
      !intent.parameters || intent.parameters.length === 0
    ).length;

    if (intentsWithoutParams > stats.totalIntents * 0.8) {
      recommendations.push({
        type: 'parameters',
        priority: 'medium',
        message: 'Muitos intents sem parâmetros. Considere adicionar extração de entidades.',
        action: 'Revisar intents e adicionar parâmetros quando apropriado'
      });
    }

    // Verificar intents com poucas frases
    const intentsWithFewPhrases = intents.filter(intent => 
      intent.trainingPhrases.length < 3
    ).length;

    if (intentsWithFewPhrases > 0) {
      recommendations.push({
        type: 'training_quality',
        priority: 'high',
        message: `${intentsWithFewPhrases} intent(s) com menos de 3 frases de treinamento.`,
        action: 'Adicionar mais variações de frases para melhorar o reconhecimento'
      });
    }

    // Verificar se existe fallback intent
    const hasFallback = intents.some(intent => intent.isFallback);
    if (!hasFallback) {
      recommendations.push({
        type: 'fallback',
        priority: 'high',
        message: 'Nenhum intent de fallback configurado.',
        action: 'Criar intent de fallback para lidar com entradas não reconhecidas'
      });
    }

    return recommendations;
  }

  /**
   * Exportar backup completo
   */
  async exportFullBackup(outputPath) {
    try {
      console.log(`💾 Criando backup completo: ${outputPath}`);
      
      const intents = await this.intentManager.listIntents();
      const stats = await this.intentManager.getIntentStatistics();

      // Coletar todas as metadata
      const enrichedIntents = [];
      for (const intent of intents) {
        const metadata = await this.intentManager.getIntentMetadata(intent.name);
        enrichedIntents.push({
          ...intent,
          metadata
        });
      }

      const backup = {
        metadata: {
          backupDate: new Date().toISOString(),
          version: '1.0.0',
          source: 'nxtai-dialogflow-manager',
          totalIntents: intents.length,
          statistics: stats
        },
        intents: enrichedIntents,
        checksum: this.generateChecksum(enrichedIntents)
      };

      const jsonContent = JSON.stringify(backup, null, 2);
      fs.writeFileSync(outputPath, jsonContent);
      
      console.log(`✅ Backup completo criado: ${outputPath}`);
      return {
        success: true,
        intentsCount: intents.length,
        filePath: outputPath,
        fileSize: jsonContent.length,
        checksum: backup.checksum
      };

    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      throw new Error(`Falha ao criar backup: ${error.message}`);
    }
  }

  /**
   * Gerar checksum para validação
   */
  generateChecksum(data) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }
}

module.exports = IntentExporter;