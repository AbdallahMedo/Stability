const { db } = require('../src/config/firebase');

async function checkTokens() {
  console.log('🔍 Checking registered FCM tokens...');
  try {
    const snapshot = await db.collection('fcm_tokens').get();
    console.log(`📊 Total documents found: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('No tokens found.');
      return;
    }

    const tokens = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      tokens.push({
        id: doc.id,
        token: data.token ? data.token.substring(0, 20) + '...' : 'INVALID',
        createdAt: data.createdAt ? data.createdAt.toDate() : 'N/A',
        lastUsed: data.lastUsed ? data.lastUsed.toDate() : 'N/A'
      });
    });

    console.table(tokens);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking tokens:', error);
    process.exit(1);
  }
}

checkTokens();
