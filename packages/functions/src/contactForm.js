const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {getFirestore} = require("firebase-admin/firestore");
const cors = require("cors")({origin: true});

/**
 * @name apiContactFormCreate
 * @description Handles contact form submissions from the websites.
 * It expects a POST request with name, email, phone, service, and message in the body.
 * Saves the submission to a 'contacts' collection in Firestore.
 */
exports.apiContactFormCreate = onRequest({invoker: "public"}, async (request, response) => {
  // Handle CORS preflight requests and set CORS headers for the main request.
  cors(request, response, async () => {
    // Ensure the request is a POST request.
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const { name, email, phone, service, message } = request.body;

    // Basic validation
    if (!name || !email || !service || !message) {
      logger.error("Validation failed: Required field missing.", request.body);
      response.status(400).send("Please fill out all required fields.");
      return;
    }

    try {
      const submission = {
        name,
        email,
        phone: phone || null, // Save phone if provided, otherwise null
        service,
        message,
        submittedAt: new Date().toISOString(),
        status: "new", // Add a default status for new submissions
      };

      // Save the submission to Firestore
      const writeResult = await getFirestore()
        .collection("contacts")
        .add(submission);

      logger.info(`New contact submission from ${email} saved with ID: ${writeResult.id}`);

      // Send a success response
      response.status(200).json({
        message: "Your message has been received. Thank you!",
        submissionId: writeResult.id,
      });
    } catch (error) {
      logger.error("Error saving contact submission to Firestore:", error);
      response.status(500).send("Something went wrong. Please try again later.");
    }
  });
});
