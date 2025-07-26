"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.measurePerformance = measurePerformance;
exports.withCorrelation = withCorrelation;
const v2_1 = require("firebase-functions/v2");
class Logger {
    constructor() {
        this.context = {};
    }
    setContext(context) {
        this.context = Object.assign(Object.assign({}, this.context), context);
    }
    clearContext() {
        this.context = {};
    }
    formatMessage(message, meta) {
        const timestamp = new Date().toISOString();
        const contextStr = Object.keys(this.context).length > 0
            ? ` [${JSON.stringify(this.context)}]`
            : '';
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp}${contextStr} ${message}${metaStr}`;
    }
    debug(message, meta) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.formatMessage(message, meta));
        }
        v2_1.logger.debug(message, Object.assign(Object.assign({}, this.context), meta));
    }
    info(message, meta) {
        console.info(this.formatMessage(message, meta));
        v2_1.logger.info(message, Object.assign(Object.assign({}, this.context), meta));
    }
    warn(message, meta) {
        console.warn(this.formatMessage(message, meta));
        v2_1.logger.warn(message, Object.assign(Object.assign({}, this.context), meta));
    }
    error(message, error, meta) {
        const errorMeta = error instanceof Error
            ? {
                error: error.message,
                stack: error.stack,
                name: error.name
            }
            : { error };
        const fullMeta = Object.assign(Object.assign(Object.assign({}, this.context), errorMeta), meta);
        console.error(this.formatMessage(message, fullMeta));
        v2_1.logger.error(message, fullMeta);
    }
    // Structured logging methods
    userAction(userId, action, details) {
        this.info(`User action: ${action}`, {
            userId,
            action,
            details,
            type: 'user_action'
        });
    }
    agentActivity(agentId, activity, details) {
        this.info(`Agent activity: ${activity}`, {
            agentId,
            activity,
            details,
            type: 'agent_activity'
        });
    }
    conversationEvent(conversationId, event, details) {
        this.info(`Conversation event: ${event}`, {
            conversationId,
            event,
            details,
            type: 'conversation_event'
        });
    }
    apiRequest(method, path, duration, statusCode) {
        this.info(`API Request: ${method} ${path}`, {
            method,
            path,
            duration,
            statusCode,
            type: 'api_request'
        });
    }
    performance(operation, duration, details) {
        this.info(`Performance: ${operation}`, {
            operation,
            duration,
            details,
            type: 'performance'
        });
    }
    security(event, details) {
        this.warn(`Security event: ${event}`, {
            event,
            details,
            type: 'security'
        });
    }
}
exports.logger = new Logger();
// Performance measurement utility
function measurePerformance(operation, fn) {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            exports.logger.performance(operation, duration);
            resolve(result);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            exports.logger.performance(operation, duration, { error: true });
            exports.logger.error(`Performance measurement failed for ${operation}`, error);
            reject(error);
        }
    });
}
// Request correlation middleware
function withCorrelation(fn) {
    return async (...args) => {
        const correlationId = Math.random().toString(36).substring(2, 15);
        exports.logger.setContext({ correlationId });
        try {
            return await fn(...args);
        }
        finally {
            exports.logger.clearContext();
        }
    };
}
//# sourceMappingURL=logger.js.map