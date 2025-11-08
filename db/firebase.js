const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let app; 

if (!admin.apps.length) {
  // Prefer explicit JSON path via env; fallback to firebase_conn.json at repo root
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account JSON not found at ${serviceAccountPath}. Set FIREBASE_SERVICE_ACCOUNT_PATH or add firebase_conn.json.`);
  }

  const serviceAccount = require(serviceAccountPath);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
module.exports = { admin, db };
