const {setGlobalOptions} = require("firebase-functions/v2");
const {initializeApp} = require("firebase-admin/app");

// Initialize Firebase Admin SDK
initializeApp();

// Set global options for functions
setGlobalOptions({ maxInstances: 10 });

// Import and export functions from their individual files
const { apiContactFormCreate } = require('./src/contactForm');
exports.apiContactFormCreate = apiContactFormCreate;
