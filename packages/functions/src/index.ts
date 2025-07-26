import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as morgan from 'morgan';

// Initialize Firebase Admin
initializeApp();

// Initialize services
export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();

// Import route handlers
import { organizationRoutes } from './routes/organizationRoutes';
import { leadRoutes } from './routes/leadRoutes';
import { userRoutes } from './routes/userRoutes';
import { campaignRoutes } from './routes/campaignRoutes';
import { whatsappRoutes } from './routes/whatsappRoutes';
import { emailRoutes } from './routes/emailRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';
import { webhookRoutes } from './routes/webhookRoutes';
import { automationRoutes } from './routes/automationRoutes';
import { integrationRoutes } from './routes/integrationRoutes';

// Import middleware
import { authMiddleware } from './middleware/authMiddleware';
import { rateLimitMiddleware } from './middleware/rateLimitMiddleware';
import { validationMiddleware } from './middleware/validationMiddleware';
import { errorHandler } from './middleware/errorHandler';

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
app.use(rateLimitMiddleware);

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
app.use('/api/organizations', authMiddleware, organizationRoutes);
app.use('/api/leads', authMiddleware, leadRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/automations', authMiddleware, automationRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);

// Webhook routes (no auth required)
app.use('/webhooks', webhookRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandler);

// Export the Express app as a Cloud Function
export const api = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
    maxInstances: 100,
  })
  .https
  .onRequest(app);

// Export webhook handler separately for better performance
export const webhooks = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    maxInstances: 50,
  })
  .https
  .onRequest(webhookRoutes);

// Scheduled functions
export const dailyAnalytics = functions
  .region('us-central1')
  .pubsub
  .schedule('0 2 * * *') // Daily at 2 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const { generateDailyAnalytics } = await import('./scheduled/analyticsScheduler');
    return generateDailyAnalytics();
  });

export const weeklyReports = functions
  .region('us-central1')
  .pubsub
  .schedule('0 8 * * 1') // Weekly on Monday at 8 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const { generateWeeklyReports } = await import('./scheduled/reportScheduler');
    return generateWeeklyReports();
  });

export const cleanupTempFiles = functions
  .region('us-central1')
  .pubsub
  .schedule('0 3 * * *') // Daily at 3 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const { cleanupTempFiles } = await import('./scheduled/cleanupScheduler');
    return cleanupTempFiles();
  });

// Firestore triggers
export const onUserCreate = functions
  .region('us-central1')
  .firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const { handleUserCreate } = await import('./triggers/userTriggers');
    return handleUserCreate(snap, context);
  });

export const onLeadCreate = functions
  .region('us-central1')
  .firestore
  .document('organizations/{orgId}/leads/{leadId}')
  .onCreate(async (snap, context) => {
    const { handleLeadCreate } = await import('./triggers/leadTriggers');
    return handleLeadCreate(snap, context);
  });

export const onLeadUpdate = functions
  .region('us-central1')
  .firestore
  .document('organizations/{orgId}/leads/{leadId}')
  .onUpdate(async (change, context) => {
    const { handleLeadUpdate } = await import('./triggers/leadTriggers');
    return handleLeadUpdate(change, context);
  });

export const onCampaignUpdate = functions
  .region('us-central1')
  .firestore
  .document('organizations/{orgId}/campaigns/{campaignId}')
  .onUpdate(async (change, context) => {
    const { handleCampaignUpdate } = await import('./triggers/campaignTriggers');
    return handleCampaignUpdate(change, context);
  });

// Auth triggers
export const onUserSignUp = functions
  .region('us-central1')
  .auth
  .user()
  .onCreate(async (user) => {
    const { handleUserSignUp } = await import('./triggers/authTriggers');
    return handleUserSignUp(user);
  });

export const onUserDelete = functions
  .region('us-central1')
  .auth
  .user()
  .onDelete(async (user) => {
    const { handleUserDelete } = await import('./triggers/authTriggers');
    return handleUserDelete(user);
  });

// Storage triggers
export const onFileUpload = functions
  .region('us-central1')
  .storage
  .object()
  .onFinalize(async (object) => {
    const { handleFileUpload } = await import('./triggers/storageTriggers');
    return handleFileUpload(object);
  });

export const onFileDelete = functions
  .region('us-central1')
  .storage
  .object()
  .onDelete(async (object) => {
    const { handleFileDelete } = await import('./triggers/storageTriggers');
    return handleFileDelete(object);
  });

// Export utility functions for testing
export { db, auth, storage };

