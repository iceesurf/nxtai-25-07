import * as admin from 'firebase-admin';

export interface ContextVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  lifespan?: number; // em mensagens, -1 para permanente
  source: 'user' | 'system' | 'api' | 'webhook';
  createdAt: Date;
  expiresAt?: Date;
}

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  variables: { [key: string]: ContextVariable };
  activeContexts: string[];
  lastUpdated: Date;
  metadata?: { [key: string]: any };
}

export interface ContextRule {
  id?: string;
  name: string;
  description: string;
  condition: string; // expressão JavaScript
  action: ContextAction;
  priority: number;
  enabled: boolean;
  createdAt?: Date;
}

export interface ContextAction {
  type: 'set' | 'update' | 'delete' | 'trigger_intent' | 'call_webhook';
  target: string;
  value?: any;
  parameters?: { [key: string]: any };
}

export interface ContextTemplate {
  id?: string;
  name: string;
  description: string;
  variables: Array<{
    name: string;
    type: string;
    defaultValue?: any;
    required: boolean;
  }>;
  category: string;
  createdAt?: Date;
}

export class ContextService {
  private db: admin.firestore.Firestore;
  private contextCache: Map<string, ConversationContext>;
  private rules: ContextRule[];

  constructor() {
    this.db = admin.firestore();
    this.contextCache = new Map();
    this.rules = [];
    this.loadContextRules();
  }

  async getContext(sessionId: string): Promise<ConversationContext> {
    try {
      // Verificar cache primeiro
      if (this.contextCache.has(sessionId)) {
        const cached = this.contextCache.get(sessionId)!;
        // Verificar se não expirou
        if (Date.now() - cached.lastUpdated.getTime() < 60000) { // 1 minuto de cache
          return cached;
        }
      }

      // Buscar no Firestore
      const doc = await this.db.collection('conversation_contexts').doc(sessionId).get();
      
      if (!doc.exists) {
        // Criar contexto novo
        const newContext: ConversationContext = {
          sessionId,
          variables: {},
          activeContexts: [],
          lastUpdated: new Date(),
          metadata: {}
        };
        
        await this.saveContext(newContext);
        return newContext;
      }

      const data = doc.data()!;
      const context: ConversationContext = {
        sessionId: data.sessionId,
        userId: data.userId,
        variables: this.deserializeVariables(data.variables),
        activeContexts: data.activeContexts || [],
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        metadata: data.metadata || {}
      };

      // Limpar variáveis expiradas
      await this.cleanExpiredVariables(context);
      
      // Atualizar cache
      this.contextCache.set(sessionId, context);
      
      return context;

    } catch (error) {
      console.error('❌ Error getting context:', error);
      // Retornar contexto vazio em caso de erro
      return {
        sessionId,
        variables: {},
        activeContexts: [],
        lastUpdated: new Date()
      };
    }
  }

  async setVariable(sessionId: string, name: string, value: any, options?: {
    type?: string;
    lifespan?: number;
    source?: string;
  }): Promise<void> {
    try {
      const context = await this.getContext(sessionId);
      
      const variable: ContextVariable = {
        name,
        value,
        type: (options?.type || this.inferType(value)) as 'string' | 'number' | 'boolean' | 'object' | 'array',
        lifespan: options?.lifespan,
        source: (options?.source as any) || 'system',
        createdAt: new Date(),
        expiresAt: options?.lifespan && options.lifespan > 0 
          ? new Date(Date.now() + options.lifespan * 60000) // minutos para ms
          : undefined
      };

      context.variables[name] = variable;
      context.lastUpdated = new Date();

      await this.saveContext(context);
      
      // Executar regras de contexto
      await this.executeContextRules(context, { type: 'variable_set', variable: name, value });

    } catch (error) {
      console.error('❌ Error setting context variable:', error);
      throw new Error(`Failed to set context variable: ${name}`);
    }
  }

  async getVariable(sessionId: string, name: string): Promise<any> {
    try {
      const context = await this.getContext(sessionId);
      const variable = context.variables[name];
      
      if (!variable) {
        return undefined;
      }

      // Verificar se expirou
      if (variable.expiresAt && variable.expiresAt < new Date()) {
        await this.deleteVariable(sessionId, name);
        return undefined;
      }

      return variable.value;

    } catch (error) {
      console.error('❌ Error getting context variable:', error);
      return undefined;
    }
  }

  async deleteVariable(sessionId: string, name: string): Promise<void> {
    try {
      const context = await this.getContext(sessionId);
      
      if (context.variables[name]) {
        delete context.variables[name];
        context.lastUpdated = new Date();
        await this.saveContext(context);
      }

    } catch (error) {
      console.error('❌ Error deleting context variable:', error);
      throw new Error(`Failed to delete context variable: ${name}`);
    }
  }

  async setActiveContext(sessionId: string, contextName: string, lifespan: number = 5): Promise<void> {
    try {
      const context = await this.getContext(sessionId);
      
      // Remover contexto se já existe
      context.activeContexts = context.activeContexts.filter(c => !c.startsWith(contextName));
      
      // Adicionar com lifespan
      context.activeContexts.push(`${contextName}:${lifespan}`);
      context.lastUpdated = new Date();
      
      await this.saveContext(context);

    } catch (error) {
      console.error('❌ Error setting active context:', error);
      throw new Error(`Failed to set active context: ${contextName}`);
    }
  }

  async isContextActive(sessionId: string, contextName: string): Promise<boolean> {
    try {
      const context = await this.getContext(sessionId);
      return context.activeContexts.some(c => c.startsWith(contextName + ':'));

    } catch (error) {
      console.error('❌ Error checking active context:', error);
      return false;
    }
  }

  async decrementContextLifespans(sessionId: string): Promise<void> {
    try {
      const context = await this.getContext(sessionId);
      
      context.activeContexts = context.activeContexts
        .map(c => {
          const [name, lifespanStr] = c.split(':');
          const lifespan = parseInt(lifespanStr) - 1;
          return lifespan > 0 ? `${name}:${lifespan}` : null;
        })
        .filter(c => c !== null) as string[];

      context.lastUpdated = new Date();
      await this.saveContext(context);

    } catch (error) {
      console.error('❌ Error decrementing context lifespans:', error);
    }
  }

  async mergeContexts(sessionId: string, sourceSessionId: string): Promise<void> {
    try {
      const [targetContext, sourceContext] = await Promise.all([
        this.getContext(sessionId),
        this.getContext(sourceSessionId)
      ]);

      // Mesclar variáveis (target tem prioridade)
      Object.entries(sourceContext.variables).forEach(([name, variable]) => {
        if (!targetContext.variables[name]) {
          targetContext.variables[name] = variable;
        }
      });

      // Mesclar contextos ativos
      sourceContext.activeContexts.forEach(context => {
        if (!targetContext.activeContexts.includes(context)) {
          targetContext.activeContexts.push(context);
        }
      });

      targetContext.lastUpdated = new Date();
      await this.saveContext(targetContext);

    } catch (error) {
      console.error('❌ Error merging contexts:', error);
      throw new Error('Failed to merge contexts');
    }
  }

  async createContextRule(rule: ContextRule): Promise<string> {
    try {
      const ruleData = {
        ...rule,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('context_rules').add(ruleData);
      
      // Recarregar regras
      await this.loadContextRules();
      
      console.log(`✅ Context rule created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating context rule:', error);
      throw new Error('Failed to create context rule');
    }
  }

  async loadContextRules(): Promise<void> {
    try {
      const snapshot = await this.db
        .collection('context_rules')
        .where('enabled', '==', true)
        .orderBy('priority', 'desc')
        .get();

      this.rules = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          condition: data.condition,
          action: data.action,
          priority: data.priority,
          enabled: data.enabled,
          createdAt: data.createdAt?.toDate()
        };
      });

      console.log(`✅ Loaded ${this.rules.length} context rules`);

    } catch (error) {
      console.error('❌ Error loading context rules:', error);
    }
  }

  private async executeContextRules(context: ConversationContext, event: any): Promise<void> {
    try {
      for (const rule of this.rules) {
        try {
          // Avaliar condição (implementação simplificada)
          if (this.evaluateCondition(rule.condition, context, event)) {
            await this.executeContextAction(context, rule.action);
          }
        } catch (error) {
          console.error(`❌ Error executing context rule ${rule.name}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error executing context rules:', error);
    }
  }

  private evaluateCondition(condition: string, context: ConversationContext, event: any): boolean {
    try {
      // Implementação simplificada - em produção usar um parser seguro
      const variables = Object.fromEntries(
        Object.entries(context.variables).map(([name, variable]) => [name, variable.value])
      );

      // Criar contexto seguro para avaliação
      const evalContext = {
        variables,
        activeContexts: context.activeContexts,
        event,
        sessionId: context.sessionId,
        userId: context.userId
      };

      // Substituir variáveis na condição
      let evaluableCondition = condition;
      Object.entries(variables).forEach(([name, value]) => {
        evaluableCondition = evaluableCondition.replace(
          new RegExp(`\\$${name}`, 'g'), 
          JSON.stringify(value)
        );
      });

      // Avaliação básica (em produção, usar biblioteca segura como vm2)
      return eval(evaluableCondition);

    } catch (error) {
      console.error('❌ Error evaluating condition:', error);
      return false;
    }
  }

  private async executeContextAction(context: ConversationContext, action: ContextAction): Promise<void> {
    try {
      switch (action.type) {
        case 'set':
          context.variables[action.target] = {
            name: action.target,
            value: action.value,
            type: this.inferType(action.value),
            source: 'system',
            createdAt: new Date()
          };
          break;

        case 'update':
          if (context.variables[action.target]) {
            context.variables[action.target].value = action.value;
          }
          break;

        case 'delete':
          delete context.variables[action.target];
          break;

        case 'trigger_intent':
          // Implementar disparo de intent
          console.log(`🔄 Triggering intent: ${action.target}`);
          break;

        case 'call_webhook':
          // Implementar chamada de webhook
          console.log(`🔗 Calling webhook: ${action.target}`);
          break;
      }

      context.lastUpdated = new Date();
      await this.saveContext(context);

    } catch (error) {
      console.error('❌ Error executing context action:', error);
    }
  }

  async createContextTemplate(template: ContextTemplate): Promise<string> {
    try {
      const templateData = {
        ...template,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('context_templates').add(templateData);
      console.log(`✅ Context template created: ${docRef.id}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating context template:', error);
      throw new Error('Failed to create context template');
    }
  }

  async applyContextTemplate(sessionId: string, templateId: string, values?: { [key: string]: any }): Promise<void> {
    try {
      const templateDoc = await this.db.collection('context_templates').doc(templateId).get();
      
      if (!templateDoc.exists) {
        throw new Error(`Context template not found: ${templateId}`);
      }

      const template = templateDoc.data() as ContextTemplate;
      const context = await this.getContext(sessionId);

      // Aplicar variáveis do template
      template.variables.forEach(variable => {
        const value = values?.[variable.name] || variable.defaultValue;
        
        if (variable.required && value === undefined) {
          throw new Error(`Required variable not provided: ${variable.name}`);
        }

        if (value !== undefined) {
          context.variables[variable.name] = {
            name: variable.name,
            value,
            type: variable.type as any,
            source: 'system',
            createdAt: new Date()
          };
        }
      });

      context.lastUpdated = new Date();
      await this.saveContext(context);

    } catch (error) {
      console.error('❌ Error applying context template:', error);
      throw new Error(`Failed to apply context template: ${templateId}`);
    }
  }

  private async saveContext(context: ConversationContext): Promise<void> {
    try {
      const contextData = {
        sessionId: context.sessionId,
        userId: context.userId,
        variables: this.serializeVariables(context.variables),
        activeContexts: context.activeContexts,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        metadata: context.metadata || {}
      };

      await this.db.collection('conversation_contexts').doc(context.sessionId).set(contextData);
      
      // Atualizar cache
      this.contextCache.set(context.sessionId, context);

    } catch (error) {
      console.error('❌ Error saving context:', error);
      throw error;
    }
  }

  private serializeVariables(variables: { [key: string]: ContextVariable }): any {
    const serialized: any = {};
    
    Object.entries(variables).forEach(([name, variable]) => {
      serialized[name] = {
        name: variable.name,
        value: variable.value,
        type: variable.type,
        lifespan: variable.lifespan,
        source: variable.source,
        createdAt: variable.createdAt,
        expiresAt: variable.expiresAt
      };
    });

    return serialized;
  }

  private deserializeVariables(data: any): { [key: string]: ContextVariable } {
    const variables: { [key: string]: ContextVariable } = {};
    
    if (data) {
      Object.entries(data).forEach(([name, variableData]: [string, any]) => {
        variables[name] = {
          name: variableData.name,
          value: variableData.value,
          type: variableData.type,
          lifespan: variableData.lifespan,
          source: variableData.source,
          createdAt: variableData.createdAt?.toDate() || new Date(),
          expiresAt: variableData.expiresAt?.toDate()
        };
      });
    }

    return variables;
  }

  private async cleanExpiredVariables(context: ConversationContext): Promise<void> {
    const now = new Date();
    let hasExpired = false;

    Object.entries(context.variables).forEach(([name, variable]) => {
      if (variable.expiresAt && variable.expiresAt < now) {
        delete context.variables[name];
        hasExpired = true;
      }
    });

    if (hasExpired) {
      context.lastUpdated = new Date();
      await this.saveContext(context);
    }
  }

  private inferType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) return 'array';
    if (value === null || value === undefined) return 'string';
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return type;
    }
    return 'object';
  }

  async clearContext(sessionId: string): Promise<void> {
    try {
      await this.db.collection('conversation_contexts').doc(sessionId).delete();
      this.contextCache.delete(sessionId);
      console.log(`✅ Context cleared for session: ${sessionId}`);

    } catch (error) {
      console.error('❌ Error clearing context:', error);
      throw new Error(`Failed to clear context for session: ${sessionId}`);
    }
  }

  async exportContext(sessionId: string): Promise<ConversationContext> {
    return this.getContext(sessionId);
  }

  async importContext(sessionId: string, context: ConversationContext): Promise<void> {
    context.sessionId = sessionId;
    context.lastUpdated = new Date();
    await this.saveContext(context);
  }
}