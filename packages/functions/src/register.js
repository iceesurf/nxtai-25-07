const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');
const bcrypt = require('bcrypt');

const corsHandler = cors({ origin: true });

admin.initializeApp();

// Função HTTP com validação
export const createUser = functions.https.onRequest(async (request, response) => {
    corsHandler(request, response, async () => {
      try {
        // Validar método
        if (request.method !== 'POST') {
          response.status(405).json({ error: 'Method not allowed' });
          return;
        }
  
        // Pegar dados do body
        const { name, email, password, passwordConfirmation } = request.body;
  
        // Validar dados
        if (!name || !email || !password || !passwordConfirmation) {
          response.status(400).json({ error: 'Name, email, password and password confirmation are required' });
          return;
        }

        if (password !== passwordConfirmation) {
          response.status(400).json({ error: 'Passwords do not match' });
          return;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
  
        // Criar usuário no Firestore
        const db = admin.firestore();
        const userRef = await db.collection('users').add({
          name,
          email,
          password: hashedPassword,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
  
        response.status(201).json({
          success: true,
          id: userRef.id,
          message: 'User created successfully',
        });
  
      } catch (error) {
        console.error('Error creating user:', error);
        response.status(500).json({ error: 'Internal server error' });
      }
    });
  });