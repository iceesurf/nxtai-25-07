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
exports.handleContactForm = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firestore if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.handleContactForm = (0, https_1.onRequest)({ cors: true }, // Enable CORS for requests from your website
async (req, res) => {
    // We only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const { name, email, message } = req.body;
        // Basic server-side validation
        if (!name || !email || !message) {
            logger.warn("Validation failed: A field is missing.", req.body);
            res.status(400).json({ error: "Todos os campos são obrigatórios." });
            return;
        }
        logger.info(`New lead received from: ${name} (${email})`);
        // Add a new document to the 'leads' collection
        const leadRef = await db.collection("leads").add({
            name,
            email,
            message,
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // Track submission time
        });
        res.status(201).json({
            message: "Mensagem recebida com sucesso!",
            leadId: leadRef.id,
        });
    }
    catch (error) {
        logger.error("Error creating new lead:", error);
        res.status(500).json({ error: "Ocorreu um erro interno ao processar sua solicitação." });
    }
});
//# sourceMappingURL=contact.js.map