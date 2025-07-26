import { logger as functionsLogger } from 'firebase-functions/v2';

export interface LogContext {
  userId?: string;
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  agentId?: string;
  conversationId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private formatMessage(message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 
      ? ` [${JSON.stringify(this.context)}]` 
      : '';
    
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    
    return `${timestamp}${contextStr} ${message}${metaStr}`;
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(message, meta));
    }
    functionsLogger.debug(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: any) {
    console.info(this.formatMessage(message, meta));
    functionsLogger.info(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: any) {
    console.warn(this.formatMessage(message, meta));
    functionsLogger.warn(message, { ...this.context, ...meta });
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = error instanceof Error 
      ? { 
          error: error.message, 
          stack: error.stack,
          name: error.name 
        }
      : { error };

    const fullMeta = { ...this.context, ...errorMeta, ...meta };
    
    console.error(this.formatMessage(message, fullMeta));
    functionsLogger.error(message, fullMeta);
  }

  // Structured logging methods
  userAction(userId: string, action: string, details?: any) {
    this.info(`User action: ${action}`, {
      userId,
      action,
      details,
      type: 'user_action'
    });
  }

  agentActivity(agentId: string, activity: string, details?: any) {
    this.info(`Agent activity: ${activity}`, {
      agentId,
      activity,
      details,
      type: 'agent_activity'
    });
  }

  conversationEvent(conversationId: string, event: string, details?: any) {
    this.info(`Conversation event: ${event}`, {
      conversationId,
      event,
      details,
      type: 'conversation_event'
    });
  }

  apiRequest(method: string, path: string, duration?: number, statusCode?: number) {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      duration,
      statusCode,
      type: 'api_request'
    });
  }

  performance(operation: string, duration: number, details?: any) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      details,
      type: 'performance'
    });
  }

  security(event: string, details?: any) {
    this.warn(`Security event: ${event}`, {
      event,
      details,
      type: 'security'
    });
  }
}

export const logger = new Logger();

// Performance measurement utility
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      logger.performance(operation, duration);
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.performance(operation, duration, { error: true });
      logger.error(`Performance measurement failed for ${operation}`, error);
      reject(error);
    }
  });
}

// Request correlation middleware
export function withCorrelation<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const correlationId = Math.random().toString(36).substring(2, 15);
    
    logger.setContext({ correlationId });
    
    try {
      return await fn(...args);
    } finally {
      logger.clearContext();
    }
  };
}