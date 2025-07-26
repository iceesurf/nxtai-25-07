import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import { IntentService } from './intent.service';
import { EntityService } from './entity.service';
import { AnalyticsService } from './analytics.service';
import { TrainingService } from './training.service';

export interface BackupConfig {
  id?: string;
  name: string;
  description: string;
  schedule: BackupSchedule;
  retention: BackupRetention;
  targets: BackupTarget[];
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BackupSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timezone: string;
}

export interface BackupRetention {
  daily: number; // days
  weekly: number; // weeks
  monthly: number; // months
  yearly: number; // years
}

export interface BackupTarget {
  type: 'intents' | 'entities' | 'training_data' | 'analytics' | 'conversations' | 'contexts' | 'all';
  filters?: BackupFilter;
}

export interface BackupFilter {
  dateRange?: { startDate: Date; endDate: Date };
  languages?: string[];
  categories?: string[];
  status?: string[];
}

export interface BackupMetadata {
  id: string;
  configId: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  size: number; // bytes
  fileCount: number;
  targets: string[];
  environment: string;
  version: string;
  checksum: string;
  storageLocation: string;
  createdBy?: string;
}

export interface RestoreOptions {
  targetEnvironment: 'dev' | 'staging' | 'production';
  overwriteExisting: boolean;
  selectiveRestore: boolean;
  restoreTargets?: string[];
  mapping?: { [oldId: string]: string }; // Para mapear IDs antigos para novos
}

export interface BackupReport {
  id: string;
  period: { startDate: Date; endDate: Date };
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  totalSize: number;
  avgBackupTime: number;
  storageUsage: {
    current: number;
    projected: number;
    available: number;
  };
  recommendations: string[];
  createdAt: Date;
}

export class BackupService {
  private db: admin.firestore.Firestore;
  private storage: Storage;
  private intentService: IntentService;
  private entityService: EntityService;
  private analyticsService: AnalyticsService;
  private trainingService: TrainingService;
  private bucketName: string;

  constructor(
    intentService: IntentService,
    entityService: EntityService,
    analyticsService: AnalyticsService,
    trainingService: TrainingService,
    bucketName: string = 'nxtai-backups'
  ) {
    this.db = admin.firestore();
    this.storage = new Storage();
    this.intentService = intentService;
    this.entityService = entityService;
    this.analyticsService = analyticsService;
    this.trainingService = trainingService;
    this.bucketName = bucketName;
  }

  async createBackupConfig(config: BackupConfig): Promise<string> {
    try {
      const configData = {
        ...config,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('backup_configs').add(configData);
      console.log(`✅ Backup config created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating backup config:', error);
      throw new Error('Failed to create backup config');
    }
  }

  async createBackup(configId: string, type: 'full' | 'incremental' | 'differential' = 'full'): Promise<string> {
    try {
      console.log(`💾 Starting backup with config: ${configId}`);
      
      // Buscar configuração
      const configDoc = await this.db.collection('backup_configs').doc(configId).get();
      if (!configDoc.exists) {
        throw new Error(`Backup config not found: ${configId}`);
      }

      const config = configDoc.data() as BackupConfig;
      const backupId = this.generateBackupId();
      const startTime = new Date();

      // Criar metadata inicial
      const metadata: BackupMetadata = {
        id: backupId,
        configId,
        name: `${config.name}_${startTime.toISOString().split('T')[0]}`,
        type,
        status: 'running',
        startTime,
        size: 0,
        fileCount: 0,
        targets: config.targets.map(t => t.type),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        checksum: '',
        storageLocation: `gs://${this.bucketName}/${backupId}`,
        createdBy: 'system'
      };

      // Salvar metadata
      await this.db.collection('backup_metadata').doc(backupId).set({
        ...metadata,
        startTime: admin.firestore.FieldValue.serverTimestamp()
      });

      try {
        // Executar backup
        const backupData = await this.executeBackup(config, type);
        
        // Upload para storage
        const { size, checksum } = await this.uploadBackupToStorage(backupId, backupData);
        
        const endTime = new Date();
        
        // Atualizar metadata
        await this.db.collection('backup_metadata').doc(backupId).update({
          status: 'completed',
          endTime: admin.firestore.FieldValue.serverTimestamp(),
          size,
          fileCount: Object.keys(backupData).length,
          checksum
        });

        console.log(`✅ Backup completed: ${backupId} (${size} bytes)`);
        
        // Limpar backups antigos baseado na política de retenção
        await this.cleanupOldBackups(config.retention);
        
        return backupId;

      } catch (error) {
        // Atualizar status para falha
        await this.db.collection('backup_metadata').doc(backupId).update({
          status: 'failed',
          endTime: admin.firestore.FieldValue.serverTimestamp()
        });

        throw error;
      }

    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeBackup(config: BackupConfig, type: string): Promise<{ [key: string]: any }> {
    const backupData: { [key: string]: any } = {};
    
    for (const target of config.targets) {
      console.log(`📦 Backing up: ${target.type}`);
      
      switch (target.type) {
        case 'intents':
          backupData.intents = await this.backupIntents(target.filters);
          break;
          
        case 'entities':
          backupData.entities = await this.backupEntities(target.filters);
          break;
          
        case 'training_data':
          backupData.training_data = await this.backupTrainingData(target.filters);
          break;
          
        case 'analytics':
          backupData.analytics = await this.backupAnalytics(target.filters);
          break;
          
        case 'conversations':
          backupData.conversations = await this.backupConversations(target.filters);
          break;
          
        case 'contexts':
          backupData.contexts = await this.backupContexts(target.filters);
          break;
          
        case 'all':
          backupData.intents = await this.backupIntents();
          backupData.entities = await this.backupEntities();
          backupData.training_data = await this.backupTrainingData();
          backupData.analytics = await this.backupAnalytics();
          backupData.conversations = await this.backupConversations();
          backupData.contexts = await this.backupContexts();
          break;
      }
    }

    // Adicionar metadata do backup
    backupData._metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      type,
      environment: process.env.NODE_ENV || 'development'
    };

    return backupData;
  }

  private async backupIntents(filters?: BackupFilter): Promise<any[]> {
    try {
      const intents = await this.intentService.exportIntents();
      return this.applyFilters(intents, filters);
    } catch (error) {
      console.error('❌ Error backing up intents:', error);
      return [];
    }
  }

  private async backupEntities(filters?: BackupFilter): Promise<any[]> {
    try {
      const entities = await this.entityService.exportEntityTypes();
      return this.applyFilters(entities, filters);
    } catch (error) {
      console.error('❌ Error backing up entities:', error);
      return [];
    }
  }

  private async backupTrainingData(filters?: BackupFilter): Promise<any[]> {
    try {
      // Buscar dados de treinamento
      let query = this.db.collection('training_data') as admin.firestore.Query;
      
      if (filters?.dateRange) {
        query = query
          .where('createdAt', '>=', filters.dateRange.startDate)
          .where('createdAt', '<=', filters.dateRange.endDate);
      }
      
      if (filters?.languages) {
        query = query.where('language', 'in', filters.languages);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error('❌ Error backing up training data:', error);
      return [];
    }
  }

  private async backupAnalytics(filters?: BackupFilter): Promise<any[]> {
    try {
      let query = this.db.collection('conversation_analytics') as admin.firestore.Query;
      
      if (filters?.dateRange) {
        query = query
          .where('timestamp', '>=', filters.dateRange.startDate)
          .where('timestamp', '<=', filters.dateRange.endDate);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error('❌ Error backing up analytics:', error);
      return [];
    }
  }

  private async backupConversations(filters?: BackupFilter): Promise<any[]> {
    try {
      let query = this.db.collection('sessions') as admin.firestore.Query;
      
      if (filters?.dateRange) {
        query = query
          .where('startTime', '>=', filters.dateRange.startDate)
          .where('startTime', '<=', filters.dateRange.endDate);
      }

      const snapshot = await query.get();
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Incluir conversas de cada sessão
      for (const session of sessions) {
        const conversationSnapshot = await this.db
          .collection('sessions')
          .doc(session.id)
          .collection('conversation')
          .get();
        
        (session as any).conversation = conversationSnapshot.docs.map(doc => doc.data());
      }
      
      return sessions;
      
    } catch (error) {
      console.error('❌ Error backing up conversations:', error);
      return [];
    }
  }

  private async backupContexts(filters?: BackupFilter): Promise<any[]> {
    try {
      let query = this.db.collection('conversation_contexts') as admin.firestore.Query;
      
      if (filters?.dateRange) {
        query = query
          .where('lastUpdated', '>=', filters.dateRange.startDate)
          .where('lastUpdated', '<=', filters.dateRange.endDate);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error('❌ Error backing up contexts:', error);
      return [];
    }
  }

  private applyFilters(data: any[], filters?: BackupFilter): any[] {
    if (!filters) return data;
    
    return data.filter(item => {
      // Aplicar filtros de data, idioma, categoria, etc.
      if (filters.languages && item.language && !filters.languages.includes(item.language)) {
        return false;
      }
      
      if (filters.categories && item.category && !filters.categories.includes(item.category)) {
        return false;
      }
      
      if (filters.status && item.status && !filters.status.includes(item.status)) {
        return false;
      }
      
      return true;
    });
  }

  private async uploadBackupToStorage(backupId: string, data: any): Promise<{ size: number; checksum: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `${backupId}/backup.json`;
      const file = bucket.file(fileName);
      
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData);
      
      await file.save(buffer, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            backupId,
            createdAt: new Date().toISOString()
          }
        }
      });

      // Calcular checksum
      const crypto = require('crypto');
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      
      return {
        size: buffer.length,
        checksum
      };

    } catch (error) {
      console.error('❌ Error uploading backup to storage:', error);
      throw new Error('Failed to upload backup to storage');
    }
  }

  async restoreBackup(backupId: string, options: RestoreOptions): Promise<void> {
    try {
      console.log(`🔄 Starting restore: ${backupId}`);
      
      // Buscar metadata do backup
      const metadataDoc = await this.db.collection('backup_metadata').doc(backupId).get();
      if (!metadataDoc.exists) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const metadata = metadataDoc.data() as BackupMetadata;
      
      // Download do backup
      const backupData = await this.downloadBackupFromStorage(backupId);
      
      // Validar checksum
      if (!this.validateChecksum(backupData, metadata.checksum)) {
        throw new Error('Backup checksum validation failed');
      }

      // Executar restore
      await this.executeRestore(backupData, options);
      
      console.log(`✅ Restore completed: ${backupId}`);

    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      throw new Error(`Failed to restore backup: ${backupId}`);
    }
  }

  private async downloadBackupFromStorage(backupId: string): Promise<any> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `${backupId}/backup.json`;
      const file = bucket.file(fileName);
      
      const [data] = await file.download();
      return JSON.parse(data.toString());

    } catch (error) {
      console.error('❌ Error downloading backup from storage:', error);
      throw new Error('Failed to download backup from storage');
    }
  }

  private validateChecksum(data: any, expectedChecksum: string): boolean {
    try {
      const crypto = require('crypto');
      const jsonData = JSON.stringify(data);
      const actualChecksum = crypto.createHash('sha256').update(jsonData).digest('hex');
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('❌ Error validating checksum:', error);
      return false;
    }
  }

  private async executeRestore(backupData: any, options: RestoreOptions): Promise<void> {
    const targets = options.selectiveRestore ? options.restoreTargets : Object.keys(backupData);
    
    for (const target of targets || []) {
      if (target === '_metadata') continue;
      
      console.log(`🔄 Restoring: ${target}`);
      
      switch (target) {
        case 'intents':
          await this.restoreIntents(backupData.intents, options);
          break;
          
        case 'entities':
          await this.restoreEntities(backupData.entities, options);
          break;
          
        case 'training_data':
          await this.restoreTrainingData(backupData.training_data, options);
          break;
          
        case 'analytics':
          await this.restoreAnalytics(backupData.analytics, options);
          break;
          
        case 'conversations':
          await this.restoreConversations(backupData.conversations, options);
          break;
          
        case 'contexts':
          await this.restoreContexts(backupData.contexts, options);
          break;
      }
    }
  }

  private async restoreIntents(intents: any[], options: RestoreOptions): Promise<void> {
    for (const intentData of intents) {
      try {
        if (options.overwriteExisting) {
          // Verificar se intent já existe e deletar
          const existingIntents = await this.intentService.listIntents();
          const existing = existingIntents.find(i => i.displayName === intentData.displayName);
          if (existing) {
            await this.intentService.deleteIntent(existing.name!);
          }
        }
        
        await this.intentService.createIntent(intentData);
      } catch (error) {
        console.error(`❌ Error restoring intent ${intentData.displayName}:`, error);
      }
    }
  }

  private async restoreEntities(entities: any[], options: RestoreOptions): Promise<void> {
    for (const entityData of entities) {
      try {
        if (options.overwriteExisting) {
          const existingEntities = await this.entityService.listEntityTypes();
          const existing = existingEntities.find(e => e.displayName === entityData.displayName);
          if (existing) {
            await this.entityService.deleteEntityType(existing.name!);
          }
        }
        
        await this.entityService.createEntityType(entityData);
      } catch (error) {
        console.error(`❌ Error restoring entity ${entityData.displayName}:`, error);
      }
    }
  }

  private async restoreTrainingData(trainingData: any[], options: RestoreOptions): Promise<void> {
    const batch = this.db.batch();
    
    trainingData.forEach(data => {
      const docRef = this.db.collection('training_data').doc();
      batch.set(docRef, {
        ...data,
        restoredAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
  }

  private async restoreAnalytics(analytics: any[], options: RestoreOptions): Promise<void> {
    const batch = this.db.batch();
    
    analytics.forEach(data => {
      const docRef = this.db.collection('conversation_analytics').doc();
      batch.set(docRef, {
        ...data,
        restoredAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
  }

  private async restoreConversations(conversations: any[], options: RestoreOptions): Promise<void> {
    for (const sessionData of conversations) {
      try {
        const { conversation, ...session } = sessionData;
        
        // Restaurar sessão
        await this.db.collection('sessions').doc(session.id).set({
          ...session,
          restoredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Restaurar conversas
        if (conversation) {
          const batch = this.db.batch();
          conversation.forEach((turn: any) => {
            const docRef = this.db.collection('sessions').doc(session.id).collection('conversation').doc();
            batch.set(docRef, turn);
          });
          await batch.commit();
        }
      } catch (error) {
        console.error(`❌ Error restoring conversation ${sessionData.id}:`, error);
      }
    }
  }

  private async restoreContexts(contexts: any[], options: RestoreOptions): Promise<void> {
    const batch = this.db.batch();
    
    contexts.forEach(data => {
      const docRef = this.db.collection('conversation_contexts').doc(data.id);
      batch.set(docRef, {
        ...data,
        restoredAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
  }

  private async cleanupOldBackups(retention: BackupRetention): Promise<void> {
    try {
      const now = new Date();
      
      // Calcular datas de retenção
      const retentionDates = {
        daily: new Date(now.getTime() - retention.daily * 24 * 60 * 60 * 1000),
        weekly: new Date(now.getTime() - retention.weekly * 7 * 24 * 60 * 60 * 1000),
        monthly: new Date(now.getTime() - retention.monthly * 30 * 24 * 60 * 60 * 1000),
        yearly: new Date(now.getTime() - retention.yearly * 365 * 24 * 60 * 60 * 1000)
      };

      // Buscar backups antigos
      const snapshot = await this.db
        .collection('backup_metadata')
        .where('startTime', '<', retentionDates.daily)
        .get();

      const batch = this.db.batch();
      const bucket = this.storage.bucket(this.bucketName);

      for (const doc of snapshot.docs) {
        const backup = doc.data() as BackupMetadata;
        
        // Deletar arquivo do storage
        try {
          await bucket.file(`${backup.id}/backup.json`).delete();
        } catch (error) {
          console.warn(`⚠️ Failed to delete backup file: ${backup.id}`);
        }
        
        // Deletar metadata
        batch.delete(doc.ref);
      }

      await batch.commit();
      console.log(`🗑️ Cleaned up ${snapshot.size} old backups`);

    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error);
    }
  }

  async generateBackupReport(startDate: Date, endDate: Date): Promise<BackupReport> {
    try {
      const snapshot = await this.db
        .collection('backup_metadata')
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

      const backups = snapshot.docs.map(doc => doc.data() as BackupMetadata);
      
      const totalBackups = backups.length;
      const successfulBackups = backups.filter(b => b.status === 'completed').length;
      const failedBackups = backups.filter(b => b.status === 'failed').length;
      
      const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
      const avgBackupTime = backups
        .filter(b => b.endTime)
        .reduce((sum, b) => sum + (b.endTime!.getTime() - b.startTime.getTime()), 0) / successfulBackups || 0;

      // Calcular uso de storage
      const bucket = this.storage.bucket(this.bucketName);
      const [metadata] = await bucket.getMetadata();
      const currentUsage = parseInt(metadata.metering?.sizeBytes || '0');
      
      const recommendations = this.generateBackupRecommendations(backups, totalSize, successfulBackups, failedBackups);

      const report: BackupReport = {
        id: this.generateBackupId(),
        period: { startDate, endDate },
        totalBackups,
        successfulBackups,
        failedBackups,
        totalSize,
        avgBackupTime: Math.round(avgBackupTime),
        storageUsage: {
          current: currentUsage,
          projected: currentUsage + (totalSize * 30), // Projeção para 30 dias
          available: 1073741824000 // 1TB (exemplo)
        },
        recommendations,
        createdAt: new Date()
      };

      // Salvar relatório
      await this.db.collection('backup_reports').add({
        ...report,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return report;

    } catch (error) {
      console.error('❌ Error generating backup report:', error);
      throw new Error('Failed to generate backup report');
    }
  }

  private generateBackupRecommendations(
    backups: BackupMetadata[], 
    totalSize: number, 
    successful: number, 
    failed: number
  ): string[] {
    const recommendations: string[] = [];

    const successRate = backups.length > 0 ? successful / backups.length : 0;
    
    if (successRate < 0.9) {
      recommendations.push('Taxa de sucesso dos backups está baixa. Investigar causas de falhas.');
    }

    if (failed > 0) {
      recommendations.push(`${failed} backups falharam. Verificar logs e configurações.`);
    }

    const avgSize = backups.length > 0 ? totalSize / backups.length : 0;
    if (avgSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Tamanho médio dos backups está grande. Considerar backup incremental.');
    }

    if (backups.length < 7) {
      recommendations.push('Poucos backups no período. Verificar frequência de backup.');
    }

    return recommendations;
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup_${timestamp}_${random}`;
  }

  async listBackups(limit: number = 50): Promise<BackupMetadata[]> {
    try {
      const snapshot = await this.db
        .collection('backup_metadata')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.id,
          configId: data.configId,
          name: data.name,
          type: data.type,
          status: data.status,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          size: data.size,
          fileCount: data.fileCount,
          targets: data.targets,
          environment: data.environment,
          version: data.version,
          checksum: data.checksum,
          storageLocation: data.storageLocation,
          createdBy: data.createdBy
        };
      });

    } catch (error) {
      console.error('❌ Error listing backups:', error);
      return [];
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    try {
      // Deletar arquivo do storage
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(`${backupId}/backup.json`).delete();
      
      // Deletar metadata
      await this.db.collection('backup_metadata').doc(backupId).delete();
      
      console.log(`✅ Backup deleted: ${backupId}`);

    } catch (error) {
      console.error('❌ Error deleting backup:', error);
      throw new Error(`Failed to delete backup: ${backupId}`);
    }
  }
}