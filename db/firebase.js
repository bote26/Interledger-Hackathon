const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let app;

if (!admin.apps.length) {
  // Prefer explicit JSON path via env; fallback to firebase_conn.json at repo root
  let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  // If env not provided or file doesn't exist, try repo-root firebase_conn.json
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    const fallback = path.resolve(__dirname, '..', 'firebase_conn.json');
    if (fs.existsSync(fallback)) {
      serviceAccountPath = fallback;
    }
  }

  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account JSON not found. Set FIREBASE_SERVICE_ACCOUNT_PATH to a valid path or add firebase_conn.json to the project root.`);
  }

  // Load the service account JSON
  const serviceAccount = require(serviceAccountPath);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
module.exports = { admin, db };
