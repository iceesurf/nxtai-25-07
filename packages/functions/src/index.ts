import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Import API functions
import { handleContactForm } from "./api/contact";

// Initialize Firebase Admin SDK
admin.initializeApp();
logger.info("Firebase Admin SDK initialized.");

// Group all API functions under a single export
// This will create a function named 'api' and the handler will be 'handleContactForm'
// The resulting function URL will be something like /api-handleContactForm
// We will later use rewrites in firebase.json to make it pretty.
export const api = {
    contact: handleContactForm,
};
