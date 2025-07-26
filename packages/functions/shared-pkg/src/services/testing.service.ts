import * as admin from 'firebase-admin';
import { DialogflowService } from './dialogflow.service';
import { IntentService } from './intent.service';
import { SessionService } from './session.service';

export interface TestCase {
  id?: string;
  name: string;
  description: string;
  category: 'intent' | 'entity' | 'flow' | 'integration' | 'performance';
  input: TestInput;
  expectedOutput: TestExpectedOutput;
  actualOutput?: TestActualOutput;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt?: Date;
  updatedAt?: Date;
  lastRunAt?: Date;
  runCount: number;
}

export interface TestInput {
  query: string;
  sessionId?: string;
  language?: string;
  context?: { [key: string]: any };
  parameters?: { [key: string]: any };
}

export interface TestExpectedOutput {
  intent?: string;
  minConfidence?: number;
  parameters?: { [key: string]: any };
  responseContains?: string[];
  responseNotContains?: string[];
  fulfillmentType?: string;
  sessionVariables?: { [key: string]: any };
  followUpIntents?: string[];
}

export interface TestActualOutput {
  intent: string;
  confidence: number;
  parameters: { [key: string]: any };
  response: string;
  responseTime: number;
  fulfillmentType?: string;
  sessionVariables?: { [key: string]: any };
  errors?: string[];
}

export interface TestSuite {
  id?: string;
  name: string;
  description: string;
  testCases: string[]; // IDs dos test cases
  schedule?: TestSchedule;
  environment: 'dev' | 'staging' | 'production';
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRunAt?: Date;
  createdAt?: Date;
}

export interface TestSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-31
}

export interface TestRun {
  id?: string;
  testSuiteId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  results: TestResult[];
  summary: TestSummary;
  environment: string;
}

export interface TestResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  actualOutput?: TestActualOutput;
  errors?: string[];
  screenshot?: string;
}

export interface TestSummary {
  totalDuration: number;
  successRate: number;
  avgResponseTime: number;
  intentAccuracy: number;
  confidenceDistribution: { [range: string]: number };
  topFailures: Array<{ test: string; reason: string; count: number }>;
}

export interface PerformanceTest {
  id?: string;
  name: string;
  description: string;
  type: 'load' | 'stress' | 'volume' | 'spike';
  configuration: PerformanceConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: PerformanceResults;
  createdAt?: Date;
}

export interface PerformanceConfig {
  virtualUsers: number;
  duration: number; // em segundos
  rampUpTime: number; // em segundos
  testData: TestInput[];
  thresholds: {
    avgResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface PerformanceResults {
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
  errorRate: number;
  errors: Array<{ error: string; count: number }>;
  responseTimeDistribution: Array<{ percentile: number; time: number }>;
}

export class TestingService {
  private db: admin.firestore.Firestore;
  private dialogflowService: DialogflowService;
  private intentService: IntentService;
  private sessionService: SessionService;

  constructor(
    dialogflowService: DialogflowService,
    intentService: IntentService,
    sessionService: SessionService
  ) {
    this.db = admin.firestore();
    this.dialogflowService = dialogflowService;
    this.intentService = intentService;
    this.sessionService = sessionService;
  }

  async createTestCase(testCase: TestCase): Promise<string> {
    try {
      const testCaseData = {
        ...testCase,
        status: 'pending',
        runCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('test_cases').add(testCaseData);
      console.log(`✅ Test case created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating test case:', error);
      throw new Error('Failed to create test case');
    }
  }

  async runTestCase(testCaseId: string): Promise<TestResult> {
    try {
      const startTime = new Date();
      
      // Buscar test case
      const testCaseDoc = await this.db.collection('test_cases').doc(testCaseId).get();
      if (!testCaseDoc.exists) {
        throw new Error(`Test case not found: ${testCaseId}`);
      }

      const testCase = testCaseDoc.data() as TestCase;
      console.log(`🧪 Running test case: ${testCase.name}`);

      // Atualizar status
      await this.db.collection('test_cases').doc(testCaseId).update({
        status: 'running',
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
      });

      let result: TestResult;

      try {
        // Executar teste baseado na categoria
        const actualOutput = await this.executeTest(testCase);
        
        // Validar resultado
        const isValid = this.validateTestResult(testCase.expectedOutput, actualOutput);
        
        const endTime = new Date();
        result = {
          testCaseId,
          status: isValid ? 'passed' : 'failed',
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          actualOutput,
          errors: isValid ? [] : this.getValidationErrors(testCase.expectedOutput, actualOutput)
        };

        // Atualizar test case
        await this.db.collection('test_cases').doc(testCaseId).update({
          status: result.status,
          actualOutput,
          runCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      } catch (error) {
        const endTime = new Date();
        result = {
          testCaseId,
          status: 'failed',
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          errors: [error instanceof Error ? error.message : 'Unknown error']
        };

        // Atualizar test case com erro
        await this.db.collection('test_cases').doc(testCaseId).update({
          status: 'failed',
          runCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(`✅ Test case completed: ${testCase.name} - ${result.status}`);
      return result;

    } catch (error) {
      console.error('❌ Error running test case:', error);
      throw new Error(`Failed to run test case: ${testCaseId}`);
    }
  }

  private async executeTest(testCase: TestCase): Promise<TestActualOutput> {
    const startTime = Date.now();
    
    switch (testCase.category) {
      case 'intent':
        return this.executeIntentTest(testCase);
      case 'entity':
        return this.executeEntityTest(testCase);
      case 'flow':
        return this.executeFlowTest(testCase);
      case 'integration':
        return this.executeIntegrationTest(testCase);
      case 'performance':
        return this.executePerformanceTest(testCase);
      default:
        throw new Error(`Unknown test category: ${testCase.category}`);
    }
  }

  private async executeIntentTest(testCase: TestCase): Promise<TestActualOutput> {
    const startTime = Date.now();
    
    // Criar sessão se necessário
    const sessionId = testCase.input.sessionId || await this.sessionService.createSession();
    
    // Detectar intent
    const response = await this.dialogflowService.detectIntent(
      sessionId,
      testCase.input.query
    );
    
    const responseTime = Date.now() - startTime;

    return {
      intent: response.intent,
      confidence: response.confidence,
      parameters: response.parameters || {},
      response: response.text,
      responseTime,
      fulfillmentType: 'webhook' // assumindo webhook por padrão
    };
  }

  private async executeEntityTest(testCase: TestCase): Promise<TestActualOutput> {
    // Implementação para teste de entidades
    // Similar ao teste de intent mas focado na extração de entidades
    return this.executeIntentTest(testCase);
  }

  private async executeFlowTest(testCase: TestCase): Promise<TestActualOutput> {
    // Implementação para teste de fluxo de conversa
    // Múltiplas iterações simulando conversa real
    return this.executeIntentTest(testCase);
  }

  private async executeIntegrationTest(testCase: TestCase): Promise<TestActualOutput> {
    // Implementação para teste de integração
    // Testa webhooks, APIs externas, etc.
    return this.executeIntentTest(testCase);
  }

  private async executePerformanceTest(testCase: TestCase): Promise<TestActualOutput> {
    // Implementação para teste de performance
    // Múltiplas requisições paralelas
    return this.executeIntentTest(testCase);
  }

  private validateTestResult(expected: TestExpectedOutput, actual: TestActualOutput): boolean {
    // Validar intent
    if (expected.intent && expected.intent !== actual.intent) {
      return false;
    }

    // Validar confiança mínima
    if (expected.minConfidence && actual.confidence < expected.minConfidence) {
      return false;
    }

    // Validar parâmetros
    if (expected.parameters) {
      for (const [key, value] of Object.entries(expected.parameters)) {
        if (actual.parameters[key] !== value) {
          return false;
        }
      }
    }

    // Validar conteúdo da resposta
    if (expected.responseContains) {
      for (const text of expected.responseContains) {
        if (!actual.response.includes(text)) {
          return false;
        }
      }
    }

    if (expected.responseNotContains) {
      for (const text of expected.responseNotContains) {
        if (actual.response.includes(text)) {
          return false;
        }
      }
    }

    return true;
  }

  private getValidationErrors(expected: TestExpectedOutput, actual: TestActualOutput): string[] {
    const errors: string[] = [];

    if (expected.intent && expected.intent !== actual.intent) {
      errors.push(`Expected intent: ${expected.intent}, got: ${actual.intent}`);
    }

    if (expected.minConfidence && actual.confidence < expected.minConfidence) {
      errors.push(`Expected confidence >= ${expected.minConfidence}, got: ${actual.confidence}`);
    }

    if (expected.parameters) {
      for (const [key, value] of Object.entries(expected.parameters)) {
        if (actual.parameters[key] !== value) {
          errors.push(`Expected parameter ${key}: ${value}, got: ${actual.parameters[key]}`);
        }
      }
    }

    if (expected.responseContains) {
      for (const text of expected.responseContains) {
        if (!actual.response.includes(text)) {
          errors.push(`Response should contain: "${text}"`);
        }
      }
    }

    if (expected.responseNotContains) {
      for (const text of expected.responseNotContains) {
        if (actual.response.includes(text)) {
          errors.push(`Response should not contain: "${text}"`);
        }
      }
    }

    return errors;
  }

  async createTestSuite(testSuite: TestSuite): Promise<string> {
    try {
      const testSuiteData = {
        ...testSuite,
        status: 'idle',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('test_suites').add(testSuiteData);
      console.log(`✅ Test suite created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating test suite:', error);
      throw new Error('Failed to create test suite');
    }
  }

  async runTestSuite(testSuiteId: string): Promise<string> {
    try {
      console.log(`🧪 Running test suite: ${testSuiteId}`);
      
      // Buscar test suite
      const testSuiteDoc = await this.db.collection('test_suites').doc(testSuiteId).get();
      if (!testSuiteDoc.exists) {
        throw new Error(`Test suite not found: ${testSuiteId}`);
      }

      const testSuite = testSuiteDoc.data() as TestSuite;
      
      // Criar test run
      const testRun: TestRun = {
        testSuiteId,
        startTime: new Date(),
        status: 'running',
        totalTests: testSuite.testCases.length,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          totalDuration: 0,
          successRate: 0,
          avgResponseTime: 0,
          intentAccuracy: 0,
          confidenceDistribution: {},
          topFailures: []
        },
        environment: testSuite.environment
      };

      const testRunRef = await this.db.collection('test_runs').add({
        ...testRun,
        startTime: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar status do test suite
      await this.db.collection('test_suites').doc(testSuiteId).update({
        status: 'running',
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Executar testes em paralelo (limitado)
      const batchSize = 5; // Executar 5 testes por vez
      const results: TestResult[] = [];
      
      for (let i = 0; i < testSuite.testCases.length; i += batchSize) {
        const batch = testSuite.testCases.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(testCaseId => this.runTestCase(testCaseId))
        );
        results.push(...batchResults);
      }

      // Calcular métricas finais
      const endTime = new Date();
      const passedTests = results.filter(r => r.status === 'passed').length;
      const failedTests = results.filter(r => r.status === 'failed').length;
      const skippedTests = results.filter(r => r.status === 'skipped').length;
      
      const totalDuration = endTime.getTime() - testRun.startTime.getTime();
      const successRate = testRun.totalTests > 0 ? passedTests / testRun.totalTests : 0;
      const avgResponseTime = results.reduce((sum, r) => sum + (r.actualOutput?.responseTime || 0), 0) / results.length;

      const summary: TestSummary = {
        totalDuration,
        successRate,
        avgResponseTime,
        intentAccuracy: successRate, // Simplificado
        confidenceDistribution: this.calculateConfidenceDistribution(results),
        topFailures: this.getTopFailures(results)
      };

      // Atualizar test run
      await testRunRef.update({
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        status: 'completed',
        passedTests,
        failedTests,
        skippedTests,
        results,
        summary
      });

      // Atualizar test suite
      await this.db.collection('test_suites').doc(testSuiteId).update({
        status: 'completed'
      });

      console.log(`✅ Test suite completed: ${testSuiteId} - ${passedTests}/${testRun.totalTests} passed`);
      return testRunRef.id;

    } catch (error) {
      console.error('❌ Error running test suite:', error);
      
      // Atualizar status para falha
      await this.db.collection('test_suites').doc(testSuiteId).update({
        status: 'failed'
      });
      
      throw new Error(`Failed to run test suite: ${testSuiteId}`);
    }
  }

  private calculateConfidenceDistribution(results: TestResult[]): { [range: string]: number } {
    const distribution: { [range: string]: number } = {
      '0-0.3': 0,
      '0.3-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0
    };

    results.forEach(result => {
      const confidence = result.actualOutput?.confidence || 0;
      
      if (confidence < 0.3) distribution['0-0.3']++;
      else if (confidence < 0.6) distribution['0.3-0.6']++;
      else if (confidence < 0.8) distribution['0.6-0.8']++;
      else distribution['0.8-1.0']++;
    });

    return distribution;
  }

  private getTopFailures(results: TestResult[]): Array<{ test: string; reason: string; count: number }> {
    const failures: { [key: string]: number } = {};
    
    results.filter(r => r.status === 'failed').forEach(result => {
      const reason = result.errors?.[0] || 'Unknown error';
      failures[reason] = (failures[reason] || 0) + 1;
    });

    return Object.entries(failures)
      .map(([reason, count]) => ({ test: 'Various', reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  async generateTestReport(testRunId: string): Promise<string> {
    try {
      const testRunDoc = await this.db.collection('test_runs').doc(testRunId).get();
      if (!testRunDoc.exists) {
        throw new Error(`Test run not found: ${testRunId}`);
      }

      const testRun = testRunDoc.data() as TestRun;
      
      // Gerar relatório em formato JSON/HTML
      const report = {
        testRun,
        generatedAt: new Date(),
        recommendations: this.generateTestRecommendations(testRun)
      };

      // Salvar relatório
      const reportRef = await this.db.collection('test_reports').add(report);
      
      console.log(`✅ Test report generated: ${reportRef.id}`);
      return reportRef.id;

    } catch (error) {
      console.error('❌ Error generating test report:', error);
      throw new Error('Failed to generate test report');
    }
  }

  private generateTestRecommendations(testRun: TestRun): string[] {
    const recommendations: string[] = [];

    if (testRun.summary.successRate < 0.8) {
      recommendations.push('Taxa de sucesso baixa. Revisar cases que falharam e melhorar training data.');
    }

    if (testRun.summary.avgResponseTime > 2000) {
      recommendations.push('Tempo de resposta alto. Otimizar performance do sistema.');
    }

    if (testRun.failedTests > testRun.totalTests * 0.1) {
      recommendations.push('Muitos testes falhando. Revisar intents e entities.');
    }

    const lowConfidenceCount = testRun.summary.confidenceDistribution['0-0.3'] || 0;
    if (lowConfidenceCount > testRun.totalTests * 0.2) {
      recommendations.push('Muitos resultados com baixa confiança. Adicionar mais training phrases.');
    }

    return recommendations;
  }

  async createPerformanceTest(performanceTest: PerformanceTest): Promise<string> {
    try {
      const testData = {
        ...performanceTest,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('performance_tests').add(testData);
      console.log(`✅ Performance test created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating performance test:', error);
      throw new Error('Failed to create performance test');
    }
  }

  async runPerformanceTest(testId: string): Promise<void> {
    try {
      console.log(`⚡ Running performance test: ${testId}`);
      
      const testDoc = await this.db.collection('performance_tests').doc(testId).get();
      if (!testDoc.exists) {
        throw new Error(`Performance test not found: ${testId}`);
      }

      const test = testDoc.data() as PerformanceTest;
      const startTime = new Date();

      // Atualizar status
      await this.db.collection('performance_tests').doc(testId).update({
        status: 'running'
      });

      // Executar teste de carga
      const results = await this.executeLoadTest(test.configuration);
      
      const endTime = new Date();
      
      // Salvar resultados
      await this.db.collection('performance_tests').doc(testId).update({
        status: 'completed',
        results: {
          ...results,
          startTime,
          endTime
        }
      });

      console.log(`✅ Performance test completed: ${testId}`);

    } catch (error) {
      console.error('❌ Error running performance test:', error);
      
      await this.db.collection('performance_tests').doc(testId).update({
        status: 'failed'
      });
      
      throw new Error(`Failed to run performance test: ${testId}`);
    }
  }

  private async executeLoadTest(config: PerformanceConfig): Promise<PerformanceResults> {
    // Implementação simplificada de teste de carga
    const results: PerformanceResults = {
      startTime: new Date(),
      endTime: new Date(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      errors: [],
      responseTimeDistribution: []
    };

    // Simular execução do teste
    const responseTimes: number[] = [];
    
    for (let i = 0; i < config.virtualUsers; i++) {
      try {
        const startTime = Date.now();
        
        // Simular requisição
        const testData = config.testData[i % config.testData.length];
        const sessionId = await this.sessionService.createSession();
        await this.dialogflowService.detectIntent(sessionId, testData.query);
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        results.successfulRequests++;
        
      } catch (error) {
        results.failedRequests++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const existingError = results.errors.find(e => e.error === errorMsg);
        
        if (existingError) {
          existingError.count++;
        } else {
          results.errors.push({ error: errorMsg, count: 1 });
        }
      }
    }

    results.totalRequests = config.virtualUsers;
    results.avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    results.minResponseTime = Math.min(...responseTimes);
    results.maxResponseTime = Math.max(...responseTimes);
    results.errorRate = results.failedRequests / results.totalRequests;
    results.throughput = results.totalRequests / config.duration;

    // Calcular distribuição de percentis
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    results.responseTimeDistribution = [
      { percentile: 50, time: sortedTimes[Math.floor(sortedTimes.length * 0.5)] },
      { percentile: 90, time: sortedTimes[Math.floor(sortedTimes.length * 0.9)] },
      { percentile: 95, time: sortedTimes[Math.floor(sortedTimes.length * 0.95)] },
      { percentile: 99, time: sortedTimes[Math.floor(sortedTimes.length * 0.99)] }
    ];

    return results;
  }

  async getTestStatistics(): Promise<{
    totalTestCases: number;
    totalTestSuites: number;
    totalTestRuns: number;
    successRate: number;
    avgResponseTime: number;
    testsByCategory: { [category: string]: number };
    testsByStatus: { [status: string]: number };
  }> {
    try {
      const [testCasesSnapshot, testSuitesSnapshot, testRunsSnapshot] = await Promise.all([
        this.db.collection('test_cases').get(),
        this.db.collection('test_suites').get(),
        this.db.collection('test_runs').get()
      ]);

      const testCases = testCasesSnapshot.docs.map(doc => doc.data() as TestCase);
      const testRuns = testRunsSnapshot.docs.map(doc => doc.data() as TestRun);

      const testsByCategory: { [category: string]: number } = {};
      const testsByStatus: { [status: string]: number } = {};

      testCases.forEach(testCase => {
        testsByCategory[testCase.category] = (testsByCategory[testCase.category] || 0) + 1;
        testsByStatus[testCase.status] = (testsByStatus[testCase.status] || 0) + 1;
      });

      const totalPassed = testRuns.reduce((sum, run) => sum + run.passedTests, 0);
      const totalTests = testRuns.reduce((sum, run) => sum + run.totalTests, 0);
      const successRate = totalTests > 0 ? totalPassed / totalTests : 0;

      const avgResponseTime = testRuns.reduce((sum, run) => sum + run.summary.avgResponseTime, 0) / testRuns.length || 0;

      return {
        totalTestCases: testCases.length,
        totalTestSuites: testSuitesSnapshot.size,
        totalTestRuns: testRuns.length,
        successRate,
        avgResponseTime,
        testsByCategory,
        testsByStatus
      };

    } catch (error) {
      console.error('❌ Error getting test statistics:', error);
      throw new Error('Failed to get test statistics');
    }
  }
}