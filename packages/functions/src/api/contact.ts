import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firestore if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

export const handleContactForm = onRequest(
  { cors: true }, // Enable CORS for requests from your website
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

    } catch (error) {
      logger.error("Error creating new lead:", error);
      res.status(500).json({ error: "Ocorreu um erro interno ao processar sua solicitação." });
    }
  }
);
