"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onFileDelete = exports.onFileUpload = exports.onUserDelete = exports.onUserSignUp = exports.onCampaignUpdate = exports.onLeadUpdate = exports.onLeadCreate = exports.onUserCreate = exports.cleanupTempFiles = exports.weeklyReports = exports.dailyAnalytics = exports.webhooks = exports.api = exports.storage = exports.auth = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
const functions = __importStar(require("firebase-functions"));
const express = __importStar(require("express"));
const cors = __importStar(require("cors"));
const helmet = __importStar(require("helmet"));
const compression = __importStar(require("compression"));
const morgan = __importStar(require("morgan"));
// Initialize Firebase Admin
(0, app_1.initializeApp)();
// Initialize services
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
exports.storage = (0, storage_1.getStorage)();
// Import route handlers
const organizationRoutes_1 = require("./routes/organizationRoutes");
const leadRoutes_1 = require("./routes/leadRoutes");
const userRoutes_1 = require("./routes/userRoutes");
const campaignRoutes_1 = require("./routes/campaignRoutes");
const whatsappRoutes_1 = require("./routes/whatsappRoutes");
const emailRoutes_1 = require("./routes/emailRoutes");
const analyticsRoutes_1 = require("./routes/analyticsRoutes");
const webhookRoutes_1 = require("./routes/webhookRoutes");
const automationRoutes_1 = require("./routes/automationRoutes");
const integrationRoutes_1 = require("./routes/integrationRoutes");
// Import middleware
const authMiddleware_1 = require("./middleware/authMiddleware");
const rateLimitMiddleware_1 = require("./middleware/rateLimitMiddleware");
const errorHandler_1 = require("./middleware/errorHandler");
// Create Express app
const app = express();
// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"],
        },
    },
}));
// CORS configuration
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Logging
app.use(morgan('combined'));
// Rate limiting
app.use(rateLimitMiddleware_1.rateLimitMiddleware);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
    });
});
// API routes with authentication
app.use('/api/organizations', authMiddleware_1.authMiddleware, organizationRoutes_1.organizationRoutes);
app.use('/api/leads', authMiddleware_1.authMiddleware, leadRoutes_1.leadRoutes);
app.use('/api/users', authMiddleware_1.authMiddleware, userRoutes_1.userRoutes);
app.use('/api/campaigns', authMiddleware_1.authMiddleware, campaignRoutes_1.campaignRoutes);
app.use('/api/whatsapp', authMiddleware_1.authMiddleware, whatsappRoutes_1.whatsappRoutes);
app.use('/api/email', authMiddleware_1.authMiddleware, emailRoutes_1.emailRoutes);
app.use('/api/analytics', authMiddleware_1.authMiddleware, analyticsRoutes_1.analyticsRoutes);
app.use('/api/automations', authMiddleware_1.authMiddleware, automationRoutes_1.automationRoutes);
app.use('/api/integrations', authMiddleware_1.authMiddleware, integrationRoutes_1.integrationRoutes);
// Webhook routes (no auth required)
app.use('/webhooks', webhookRoutes_1.webhookRoutes);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Export the Express app as a Cloud Function
exports.api = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
    maxInstances: 100,
})
    .https
    .onRequest(app);
// Export webhook handler separately for better performance
exports.webhooks = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    maxInstances: 50,
})
    .https
    .onRequest(webhookRoutes_1.webhookRoutes);
// Scheduled functions
exports.dailyAnalytics = functions
    .region('us-central1')
    .pubsub
    .schedule('0 2 * * *') // Daily at 2 AM
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
    const { generateDailyAnalytics } = await Promise.resolve().then(() => __importStar(require('./scheduled/analyticsScheduler')));
    return generateDailyAnalytics();
});
exports.weeklyReports = functions
    .region('us-central1')
    .pubsub
    .schedule('0 8 * * 1') // Weekly on Monday at 8 AM
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
    const { generateWeeklyReports } = await Promise.resolve().then(() => __importStar(require('./scheduled/reportScheduler')));
    return generateWeeklyReports();
});
exports.cleanupTempFiles = functions
    .region('us-central1')
    .pubsub
    .schedule('0 3 * * *') // Daily at 3 AM
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
    const { cleanupTempFiles } = await Promise.resolve().then(() => __importStar(require('./scheduled/cleanupScheduler')));
    return cleanupTempFiles();
});
// Firestore triggers
exports.onUserCreate = functions
    .region('us-central1')
    .firestore
    .document('users/{userId}')
    .onCreate(async (snap, context) => {
    const { handleUserCreate } = await Promise.resolve().then(() => __importStar(require('./triggers/userTriggers')));
    return handleUserCreate(snap, context);
});
exports.onLeadCreate = functions
    .region('us-central1')
    .firestore
    .document('organizations/{orgId}/leads/{leadId}')
    .onCreate(async (snap, context) => {
    const { handleLeadCreate } = await Promise.resolve().then(() => __importStar(require('./triggers/leadTriggers')));
    return handleLeadCreate(snap, context);
});
exports.onLeadUpdate = functions
    .region('us-central1')
    .firestore
    .document('organizations/{orgId}/leads/{leadId}')
    .onUpdate(async (change, context) => {
    const { handleLeadUpdate } = await Promise.resolve().then(() => __importStar(require('./triggers/leadTriggers')));
    return handleLeadUpdate(change, context);
});
exports.onCampaignUpdate = functions
    .region('us-central1')
    .firestore
    .document('organizations/{orgId}/campaigns/{campaignId}')
    .onUpdate(async (change, context) => {
    const { handleCampaignUpdate } = await Promise.resolve().then(() => __importStar(require('./triggers/campaignTriggers')));
    return handleCampaignUpdate(change, context);
});
// Auth triggers
exports.onUserSignUp = functions
    .region('us-central1')
    .auth
    .user()
    .onCreate(async (user) => {
    const { handleUserSignUp } = await Promise.resolve().then(() => __importStar(require('./triggers/authTriggers')));
    return handleUserSignUp(user);
});
exports.onUserDelete = functions
    .region('us-central1')
    .auth
    .user()
    .onDelete(async (user) => {
    const { handleUserDelete } = await Promise.resolve().then(() => __importStar(require('./triggers/authTriggers')));
    return handleUserDelete(user);
});
// Storage triggers
exports.onFileUpload = functions
    .region('us-central1')
    .storage
    .object()
    .onFinalize(async (object) => {
    const { handleFileUpload } = await Promise.resolve().then(() => __importStar(require('./triggers/storageTriggers')));
    return handleFileUpload(object);
});
exports.onFileDelete = functions
    .region('us-central1')
    .storage
    .object()
    .onDelete(async (object) => {
    const { handleFileDelete } = await Promise.resolve().then(() => __importStar(require('./triggers/storageTriggers')));
    return handleFileDelete(object);
});
//# sourceMappingURL=index.js.map