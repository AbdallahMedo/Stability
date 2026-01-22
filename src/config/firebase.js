const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  serviceAccount = require('../../serviceAccountKey.json');
} catch (e) {
  console.log('serviceAccountKey.json not found, checking environment variables...');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('Successfully loaded service account from environment variable.');
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', parseError);
      }
    }
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://stability-7b1c7-default-rtdb.europe-west1.firebasedatabase.app"
    });
  } else {
    console.warn("Warning: Firebase Admin not initialized with service account. Using mock/no-op mode.");
  }
}

const getDb = () => {
  if (admin.apps.length && serviceAccount) return admin.firestore();
  console.warn("Using mock DB because Firebase app is not initialized properly.");
  return {
    collection: () => ({
      doc: () => ({ set: async () => console.log('Mock DB set'), delete: async () => console.log('Mock DB delete'), update: async () => console.log('Mock DB update') }),
      add: async () => console.log('Mock DB add'),
      get: async () => ({ empty: true, forEach: () => {} }),
      where: () => ({ get: async () => ({ empty: true, forEach: () => {} }) }) // Added mock 'where'
    })
  };
};

const getMessaging = () => {
  if (admin.apps.length) return admin.messaging();
  return {
    sendEachForMulticast: async () => ({ successCount: 0, failureCount: 0 }),
    sendEach: async () => ({ successCount: 0, failureCount: 0, responses: [] })
  };
};

const getRtdb = () => {
  if (admin.apps.length) return admin.database();
  return {
    ref: () => ({
      on: () => console.log('Mock RTDB listener started'),
      off: () => console.log('Mock RTDB listener stopped'),
      once: async () => ({ val: () => null })
    })
  };
};

const db = getDb();
const messaging = getMessaging();
const rtdb = getRtdb();

module.exports = { admin, db, messaging, rtdb };
