import * as admin from 'firebase-admin';
import { TestingService } from './testing.service';
import { BackupService } from './backup.service';
import { AnalyticsService } from './analytics.service';

export interface DeploymentConfig {
  id?: string;
  name: string;
  description: string;
  environment: 'dev' | 'staging' | 'production';
  strategy: 'direct' | 'blue_green' | 'canary' | 'rolling';
  approvals: DeploymentApproval[];
  preDeployChecks: DeploymentCheck[];
  postDeployChecks: DeploymentCheck[];
  rollbackPolicy: RollbackPolicy;
  notifications: NotificationConfig[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeploymentApproval {
  type: 'manual' | 'automatic';
  requiredApprovers: string[];
  conditions?: ApprovalCondition[];
  timeout?: number; // em minutos
}

export interface ApprovalCondition {
  type: 'test_success' | 'performance_threshold' | 'security_scan' | 'manual_review';
  parameters: { [key: string]: any };
}

export interface DeploymentCheck {
  id: string;
  name: string;
  type: 'test_suite' | 'performance_test' | 'security_scan' | 'health_check' | 'custom_script';
  parameters: { [key: string]: any };
  timeout: number; // em minutos
  required: boolean;
  retryCount: number;
}

export interface RollbackPolicy {
  enabled: boolean;
  automaticTriggers: RollbackTrigger[];
  manualApprovalRequired: boolean;
  maxRollbackTime: number; // em minutos
}

export interface RollbackTrigger {
  type: 'error_rate' | 'response_time' | 'test_failure' | 'manual';
  threshold: number;
  timeWindow: number; // em minutos
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook';
  recipients: string[];
  events: DeploymentEvent[];
  template?: string;
}

export type DeploymentEvent = 'started' | 'completed' | 'failed' | 'approved' | 'rejected' | 'rolled_back';

export interface Deployment {
  id?: string;
  configId: string;
  version: string;
  environment: string;
  strategy: string;
  status: DeploymentStatus;
  startTime: Date;
  endTime?: Date;
  deployedBy: string;
  approvals: DeploymentApprovalStatus[];
  checks: DeploymentCheckResult[];
  artifacts: DeploymentArtifact[];
  rollback?: RollbackInfo;
  logs: DeploymentLog[];
  metrics?: DeploymentMetrics;
}

export type DeploymentStatus = 
  | 'pending_approval' 
  | 'approved' 
  | 'rejected' 
  | 'deploying' 
  | 'testing' 
  | 'completed' 
  | 'failed' 
  | 'rolling_back' 
  | 'rolled_back';

export interface DeploymentApprovalStatus {
  approverId: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: Date;
  comments?: string;
}

export interface DeploymentCheckResult {
  checkId: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  errors?: string[];
}

export interface DeploymentArtifact {
  type: 'intents' | 'entities' | 'flows' | 'config' | 'functions';
  name: string;
  version: string;
  checksum: string;
  size: number;
  path: string;
}

export interface RollbackInfo {
  triggeredBy: string;
  reason: string;
  timestamp: Date;
  previousVersion: string;
  rollbackDuration: number;
  success: boolean;
}

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  component?: string;
  details?: any;
}

export interface DeploymentMetrics {
  deploymentDuration: number;
  testExecutionTime: number;
  errorRate: number;
  successRate: number;
  performanceImpact: {
    responseTimeChange: number;
    throughputChange: number;
  };
}

export interface DeploymentPipeline {
  id?: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  environment: string;
  enabled: boolean;
  createdAt?: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'approve' | 'notify';
  dependsOn: string[];
  configuration: any;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'git_push';
  configuration: any;
  enabled: boolean;
}

export class DeployService {
  private db: admin.firestore.Firestore;
  private testingService: TestingService;
  private backupService: BackupService;
  private analyticsService: AnalyticsService;

  constructor(
    testingService: TestingService,
    backupService: BackupService,
    analyticsService: AnalyticsService
  ) {
    this.db = admin.firestore();
    this.testingService = testingService;
    this.backupService = backupService;
    this.analyticsService = analyticsService;
  }

  async createDeploymentConfig(config: DeploymentConfig): Promise<string> {
    try {
      const configData = {
        ...config,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('deployment_configs').add(configData);
      console.log(`✅ Deployment config created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating deployment config:', error);
      throw new Error('Failed to create deployment config');
    }
  }

  async startDeployment(configId: string, version: string, deployedBy: string): Promise<string> {
    try {
      console.log(`🚀 Starting deployment: ${configId} v${version}`);
      
      // Buscar configuração
      const configDoc = await this.db.collection('deployment_configs').doc(configId).get();
      if (!configDoc.exists) {
        throw new Error(`Deployment config not found: ${configId}`);
      }

      const config = configDoc.data() as DeploymentConfig;
      
      // Criar deployment
      const deployment: Deployment = {
        configId,
        version,
        environment: config.environment,
        strategy: config.strategy,
        status: config.approvals.length > 0 ? 'pending_approval' : 'deploying',
        startTime: new Date(),
        deployedBy,
        approvals: config.approvals.map(approval => ({
          approverId: approval.requiredApprovers[0], // Simplificado
          status: 'pending'
        })),
        checks: [...config.preDeployChecks, ...config.postDeployChecks].map(check => ({
          checkId: check.id,
          name: check.name,
          status: 'pending'
        })),
        artifacts: [],
        logs: []
      };

      const deploymentRef = await this.db.collection('deployments').add({
        ...deployment,
        startTime: admin.firestore.FieldValue.serverTimestamp()
      });

      const deploymentId = deploymentRef.id;
      
      // Log inicial
      await this.addDeploymentLog(deploymentId, 'info', `Deployment started by ${deployedBy}`);

      // Se não requer aprovação, iniciar deploy imediatamente
      if (config.approvals.length === 0) {
        await this.executeDeployment(deploymentId);
      } else {
        // Enviar notificações de aprovação
        await this.sendNotifications(config, 'started', deployment);
      }

      return deploymentId;

    } catch (error) {
      console.error('❌ Error starting deployment:', error);
      throw new Error(`Failed to start deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async approveDeployment(deploymentId: string, approverId: string, approved: boolean, comments?: string): Promise<void> {
    try {
      const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
      if (!deploymentDoc.exists) {
        throw new Error(`Deployment not found: ${deploymentId}`);
      }

      const deployment = deploymentDoc.data() as Deployment;
      
      // Atualizar aprovação
      const approvalIndex = deployment.approvals.findIndex(a => a.approverId === approverId);
      if (approvalIndex === -1) {
        throw new Error(`Approver not found: ${approverId}`);
      }

      deployment.approvals[approvalIndex] = {
        approverId,
        status: approved ? 'approved' : 'rejected',
        timestamp: new Date(),
        comments
      };

      const allApproved = deployment.approvals.every(a => a.status === 'approved');
      const anyRejected = deployment.approvals.some(a => a.status === 'rejected');

      let newStatus: DeploymentStatus = deployment.status;
      
      if (anyRejected) {
        newStatus = 'rejected';
        await this.addDeploymentLog(deploymentId, 'warn', `Deployment rejected by ${approverId}: ${comments}`);
      } else if (allApproved) {
        newStatus = 'approved';
        await this.addDeploymentLog(deploymentId, 'info', `Deployment approved by ${approverId}`);
        
        // Iniciar deployment
        await this.executeDeployment(deploymentId);
      }

      // Atualizar deployment
      await this.db.collection('deployments').doc(deploymentId).update({
        approvals: deployment.approvals,
        status: newStatus
      });

      // Enviar notificações
      const configDoc = await this.db.collection('deployment_configs').doc(deployment.configId).get();
      const config = configDoc.data() as DeploymentConfig;
      await this.sendNotifications(config, approved ? 'approved' : 'rejected', deployment);

    } catch (error) {
      console.error('❌ Error approving deployment:', error);
      throw new Error(`Failed to approve deployment: ${deploymentId}`);
    }
  }

  private async executeDeployment(deploymentId: string): Promise<void> {
    try {
      await this.addDeploymentLog(deploymentId, 'info', 'Starting deployment execution');
      
      // Atualizar status
      await this.db.collection('deployments').doc(deploymentId).update({
        status: 'deploying'
      });

      const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
      const deployment = deploymentDoc.data() as Deployment;
      
      const configDoc = await this.db.collection('deployment_configs').doc(deployment.configId).get();
      const config = configDoc.data() as DeploymentConfig;

      // 1. Criar backup antes do deploy
      await this.addDeploymentLog(deploymentId, 'info', 'Creating pre-deployment backup');
      try {
        // Criar configuração de backup temporária
        const backupConfigId = await this.backupService.createBackupConfig({
          name: `pre-deploy-${deploymentId}`,
          description: `Backup before deployment ${deploymentId}`,
          schedule: { frequency: 'manual', time: '00:00', timezone: 'UTC' },
          retention: { daily: 7, weekly: 4, monthly: 12, yearly: 1 },
          targets: [{ type: 'all' }],
          enabled: true
        });
        
        await this.backupService.createBackup(backupConfigId);
        await this.addDeploymentLog(deploymentId, 'info', 'Pre-deployment backup completed');
      } catch (error) {
        await this.addDeploymentLog(deploymentId, 'warn', `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 2. Executar checks pré-deploy
      await this.addDeploymentLog(deploymentId, 'info', 'Running pre-deployment checks');
      const preDeploySuccess = await this.runDeploymentChecks(deploymentId, config.preDeployChecks, 'pre-deploy');
      
      if (!preDeploySuccess) {
        await this.failDeployment(deploymentId, 'Pre-deployment checks failed');
        return;
      }

      // 3. Executar estratégia de deployment
      await this.addDeploymentLog(deploymentId, 'info', `Executing ${config.strategy} deployment strategy`);
      await this.executeDeploymentStrategy(deploymentId, config.strategy);

      // 4. Aguardar estabilização
      await this.addDeploymentLog(deploymentId, 'info', 'Waiting for system stabilization');
      await this.waitForStabilization(30000); // 30 segundos

      // 5. Executar checks pós-deploy
      await this.addDeploymentLog(deploymentId, 'info', 'Running post-deployment checks');
      const postDeploySuccess = await this.runDeploymentChecks(deploymentId, config.postDeployChecks, 'post-deploy');

      if (!postDeploySuccess) {
        // Tentar rollback automático se configurado
        if (config.rollbackPolicy.enabled) {
          await this.triggerRollback(deploymentId, 'Post-deployment checks failed');
        } else {
          await this.failDeployment(deploymentId, 'Post-deployment checks failed');
        }
        return;
      }

      // 6. Deployment bem-sucedido
      await this.completeDeployment(deploymentId);

    } catch (error) {
      console.error('❌ Error executing deployment:', error);
      await this.failDeployment(deploymentId, `Deployment execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runDeploymentChecks(deploymentId: string, checks: DeploymentCheck[], phase: string): Promise<boolean> {
    let allPassed = true;

    for (const check of checks) {
      await this.addDeploymentLog(deploymentId, 'info', `Running ${phase} check: ${check.name}`);
      
      // Atualizar status do check
      await this.updateCheckStatus(deploymentId, check.id, 'running');
      
      try {
        const passed = await this.executeCheck(check);
        
        if (passed) {
          await this.updateCheckStatus(deploymentId, check.id, 'passed');
          await this.addDeploymentLog(deploymentId, 'info', `Check passed: ${check.name}`);
        } else {
          await this.updateCheckStatus(deploymentId, check.id, 'failed');
          await this.addDeploymentLog(deploymentId, 'error', `Check failed: ${check.name}`);
          
          if (check.required) {
            allPassed = false;
          }
        }
      } catch (error) {
        await this.updateCheckStatus(deploymentId, check.id, 'failed');
        await this.addDeploymentLog(deploymentId, 'error', `Check error: ${check.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (check.required) {
          allPassed = false;
        }
      }
    }

    return allPassed;
  }

  private async executeCheck(check: DeploymentCheck): Promise<boolean> {
    switch (check.type) {
      case 'test_suite':
        const testSuiteId = check.parameters.testSuiteId;
        if (!testSuiteId) return false;
        
        const testRunId = await this.testingService.runTestSuite(testSuiteId);
        
        // Aguardar conclusão do teste
        await this.waitForTestCompletion(testRunId, check.timeout * 60 * 1000);
        
        // Verificar resultado
        const testRunDoc = await this.db.collection('test_runs').doc(testRunId).get();
        const testRun = testRunDoc.data();
        
        return testRun?.status === 'completed' && testRun?.summary?.successRate >= (check.parameters.minSuccessRate || 0.9);

      case 'health_check':
        // Implementar health check
        return await this.performHealthCheck(check.parameters);

      case 'performance_test':
        // Implementar teste de performance
        return await this.performPerformanceCheck(check.parameters);

      case 'security_scan':
        // Implementar scan de segurança
        return await this.performSecurityScan(check.parameters);

      case 'custom_script':
        // Executar script customizado
        return await this.executeCustomScript(check.parameters);

      default:
        console.warn(`Unknown check type: ${check.type}`);
        return false;
    }
  }

  private async executeDeploymentStrategy(deploymentId: string, strategy: string): Promise<void> {
    switch (strategy) {
      case 'direct':
        await this.executeDirectDeployment(deploymentId);
        break;
      case 'blue_green':
        await this.executeBlueGreenDeployment(deploymentId);
        break;
      case 'canary':
        await this.executeCanaryDeployment(deploymentId);
        break;
      case 'rolling':
        await this.executeRollingDeployment(deploymentId);
        break;
      default:
        throw new Error(`Unknown deployment strategy: ${strategy}`);
    }
  }

  private async executeDirectDeployment(deploymentId: string): Promise<void> {
    await this.addDeploymentLog(deploymentId, 'info', 'Executing direct deployment');
    // Implementar deployment direto
    // Por agora, simular com delay
    await this.waitForStabilization(5000);
  }

  private async executeBlueGreenDeployment(deploymentId: string): Promise<void> {
    await this.addDeploymentLog(deploymentId, 'info', 'Executing blue-green deployment');
    // Implementar blue-green deployment
    await this.waitForStabilization(10000);
  }

  private async executeCanaryDeployment(deploymentId: string): Promise<void> {
    await this.addDeploymentLog(deploymentId, 'info', 'Executing canary deployment');
    // Implementar canary deployment
    await this.waitForStabilization(15000);
  }

  private async executeRollingDeployment(deploymentId: string): Promise<void> {
    await this.addDeploymentLog(deploymentId, 'info', 'Executing rolling deployment');
    // Implementar rolling deployment
    await this.waitForStabilization(20000);
  }

  private async performHealthCheck(parameters: any): Promise<boolean> {
    // Implementação simplificada de health check
    try {
      // Verificar se serviços essenciais estão funcionando
      const firebaseHealth = await this.checkFirebaseHealth();
      const dialogflowHealth = await this.checkDialogflowHealth();
      
      return firebaseHealth && dialogflowHealth;
    } catch (error) {
      return false;
    }
  }

  private async performPerformanceCheck(parameters: any): Promise<boolean> {
    // Implementação simplificada de teste de performance
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 2000); // Simular teste
    });
  }

  private async performSecurityScan(parameters: any): Promise<boolean> {
    // Implementação simplificada de scan de segurança
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 3000); // Simular scan
    });
  }

  private async executeCustomScript(parameters: any): Promise<boolean> {
    // Implementação simplificada de script customizado
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 1000); // Simular execução
    });
  }

  private async checkFirebaseHealth(): Promise<boolean> {
    try {
      // Testar conexão com Firestore
      await this.db.collection('_health_check').limit(1).get();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkDialogflowHealth(): Promise<boolean> {
    try {
      // Implementar verificação do Dialogflow
      return true; // Simplificado
    } catch (error) {
      return false;
    }
  }

  private async triggerRollback(deploymentId: string, reason: string): Promise<void> {
    await this.addDeploymentLog(deploymentId, 'warn', `Triggering rollback: ${reason}`);
    
    await this.db.collection('deployments').doc(deploymentId).update({
      status: 'rolling_back'
    });

    // Implementar lógica de rollback
    // Por agora, simular
    await this.waitForStabilization(10000);

    await this.db.collection('deployments').doc(deploymentId).update({
      status: 'rolled_back',
      rollback: {
        triggeredBy: 'system',
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        previousVersion: 'unknown',
        rollbackDuration: 10000,
        success: true
      }
    });

    await this.addDeploymentLog(deploymentId, 'info', 'Rollback completed');
  }

  private async completeDeployment(deploymentId: string): Promise<void> {
    await this.db.collection('deployments').doc(deploymentId).update({
      status: 'completed',
      endTime: admin.firestore.FieldValue.serverTimestamp()
    });

    await this.addDeploymentLog(deploymentId, 'info', 'Deployment completed successfully');

    // Enviar notificações de sucesso
    const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
    const deployment = deploymentDoc.data() as Deployment;
    
    const configDoc = await this.db.collection('deployment_configs').doc(deployment.configId).get();
    const config = configDoc.data() as DeploymentConfig;
    
    await this.sendNotifications(config, 'completed', deployment);
  }

  private async failDeployment(deploymentId: string, reason: string): Promise<void> {
    await this.db.collection('deployments').doc(deploymentId).update({
      status: 'failed',
      endTime: admin.firestore.FieldValue.serverTimestamp()
    });

    await this.addDeploymentLog(deploymentId, 'error', `Deployment failed: ${reason}`);

    // Enviar notificações de falha
    const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
    const deployment = deploymentDoc.data() as Deployment;
    
    const configDoc = await this.db.collection('deployment_configs').doc(deployment.configId).get();
    const config = configDoc.data() as DeploymentConfig;
    
    await this.sendNotifications(config, 'failed', deployment);
  }

  private async addDeploymentLog(deploymentId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, component?: string): Promise<void> {
    try {
      await this.db.collection('deployments').doc(deploymentId).collection('logs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        level,
        message,
        component: component || 'deploy-service'
      });
    } catch (error) {
      console.error('❌ Error adding deployment log:', error);
    }
  }

  private async updateCheckStatus(deploymentId: string, checkId: string, status: string): Promise<void> {
    try {
      const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
      const deployment = deploymentDoc.data() as Deployment;
      
      const checkIndex = deployment.checks.findIndex(c => c.checkId === checkId);
      if (checkIndex >= 0) {
        deployment.checks[checkIndex].status = status as any;
        if (status === 'running') {
          deployment.checks[checkIndex].startTime = new Date();
        } else {
          deployment.checks[checkIndex].endTime = new Date();
        }
        
        await this.db.collection('deployments').doc(deploymentId).update({
          checks: deployment.checks
        });
      }
    } catch (error) {
      console.error('❌ Error updating check status:', error);
    }
  }

  private async sendNotifications(config: DeploymentConfig, event: DeploymentEvent, deployment: Deployment): Promise<void> {
    for (const notification of config.notifications) {
      if (notification.events.includes(event)) {
        try {
          await this.sendNotification(notification, event, deployment);
        } catch (error) {
          console.error('❌ Error sending notification:', error);
        }
      }
    }
  }

  private async sendNotification(notification: NotificationConfig, event: DeploymentEvent, deployment: Deployment): Promise<void> {
    const message = `Deployment ${deployment.id} ${event} in ${deployment.environment}`;
    
    switch (notification.type) {
      case 'email':
        // Implementar envio de email
        console.log(`📧 Email notification: ${message}`);
        break;
      case 'slack':
        // Implementar notificação Slack
        console.log(`💬 Slack notification: ${message}`);
        break;
      case 'webhook':
        // Implementar webhook
        console.log(`🔗 Webhook notification: ${message}`);
        break;
    }
  }

  private async waitForStabilization(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForTestCompletion(testRunId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const testRunDoc = await this.db.collection('test_runs').doc(testRunId).get();
      const testRun = testRunDoc.data();
      
      if (testRun?.status === 'completed' || testRun?.status === 'failed') {
        return;
      }
      
      await this.waitForStabilization(5000); // Verificar a cada 5 segundos
    }
    
    throw new Error('Test execution timeout');
  }

  async getDeploymentHistory(environment?: string, limit: number = 50): Promise<Deployment[]> {
    try {
      let query = this.db.collection('deployments') as admin.firestore.Query;
      
      if (environment) {
        query = query.where('environment', '==', environment);
      }
      
      const snapshot = await query
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          configId: data.configId,
          version: data.version,
          environment: data.environment,
          strategy: data.strategy,
          status: data.status,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          deployedBy: data.deployedBy,
          approvals: data.approvals || [],
          checks: data.checks || [],
          artifacts: data.artifacts || [],
          rollback: data.rollback,
          logs: data.logs || [],
          metrics: data.metrics
        };
      });

    } catch (error) {
      console.error('❌ Error getting deployment history:', error);
      return [];
    }
  }

  async getDeploymentMetrics(deploymentId: string): Promise<DeploymentMetrics | null> {
    try {
      const deploymentDoc = await this.db.collection('deployments').doc(deploymentId).get();
      if (!deploymentDoc.exists) {
        return null;
      }

      const deployment = deploymentDoc.data() as Deployment;
      
      if (!deployment.endTime) {
        return null; // Deployment ainda em progresso
      }

      const deploymentDuration = deployment.endTime.getTime() - deployment.startTime.getTime();
      
      // Calcular métricas básicas
      const passedChecks = deployment.checks.filter(c => c.status === 'passed').length;
      const totalChecks = deployment.checks.length;
      const successRate = totalChecks > 0 ? passedChecks / totalChecks : 1;

      return {
        deploymentDuration,
        testExecutionTime: 0, // Calcular baseado nos checks
        errorRate: 1 - successRate,
        successRate,
        performanceImpact: {
          responseTimeChange: 0, // Calcular baseado em analytics
          throughputChange: 0 // Calcular baseado em analytics
        }
      };

    } catch (error) {
      console.error('❌ Error getting deployment metrics:', error);
      return null;
    }
  }
}