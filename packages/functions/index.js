const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const express = require("express");
const cors = require("cors");

// Initialize Firebase Admin SDK
initializeApp();

// --- Express App Setup ---
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Import and use route handlers
const { registerUserHandler } = require('./src/register');
const { contactFormHandler } = require('./src/contactForm');

app.post('/register', registerUserHandler);
app.post('/contact', contactFormHandler);

// --- App Hosting Entry Point ---
// Check if running in a Node.js environment (like App Hosting)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// --- Cloud Functions Entry Point (for backward compatibility or emulators) ---
// This allows you to still use the Firebase emulators
exports.api = onRequest(app);
