const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

exports.registerUserHandler = async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, password, name } = req.body;

    // Basic validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields: email, password, and name.' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    try {
      // 1. Create the user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name,
      });

      console.log("Successfully created new user in Auth:", userRecord.uid);
      
      // 2. Directly create the user profile in Firestore
      const db = getFirestore();
      const userRef = db.collection('users').doc(userRecord.uid);

      await userRef.set({
        email: userRecord.email,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        createdAt: new Date().toISOString(),
        isActive: true,
      });
      
      console.log(`Successfully created user profile in Firestore for UID: ${userRecord.uid}`);

      // 3. Respond with success after both operations are complete
      return res.status(201).json({
        success: true,
        message: 'User registered successfully!',
        uid: userRecord.uid
      });

    } catch (error) {
      console.error("Error creating new user:", error);
      
      if (error.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'The email address is already in use by another account.' });
      } else if (error.code === 'auth/invalid-email') {
        return res.status(400).json({ error: 'The email address is not valid.' });
      }
      
      return res.status(500).json({ error: 'Internal server error while creating user.' });
    }
}
