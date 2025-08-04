const logger = require("firebase-functions/logger");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * @name contactFormHandler
 * @description Handles contact form submissions.
 */
exports.contactFormHandler = async (req, res) => {
    // Ensure the request is a POST request.
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { name, email, phone, service, message } = req.body;

    // Basic validation
    if (!name || !email || !service || !message) {
      logger.error("Validation failed: Required field missing.", req.body);
      res.status(400).send("Please fill out all required fields.");
      return;
    }

    try {
      const submission = {
        name,
        email,
        phone: phone || null,
        service,
        message,
        submittedAt: new Date().toISOString(),
        status: "new",
      };

      // Save the submission to Firestore
      const writeResult = await getFirestore()
        .collection("contacts")
        .add(submission);

      logger.info(`New contact submission from ${email} saved with ID: ${writeResult.id}`);

      // Send a success response
      res.status(200).json({
        message: "Your message has been received. Thank you!",
        submissionId: writeResult.id,
      });
    } catch (error) {
      logger.error("Error saving contact submission to Firestore:", error);
      res.status(500).send("Something went wrong. Please try again later.");
    }
}
