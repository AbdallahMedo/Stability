const { db } = require('../src/config/firebase');

async function cleanDuplicateTokens() {
  console.log('🧹 Starting cleanup of duplicate FCM tokens...');
  
  try {
    const snapshot = await db.collection('fcm_tokens').get();
    
    if (snapshot.empty) {
      console.log('No tokens found.');
      return;
    }

    const tokenMap = new Map();
    const duplicates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const token = data.token;
      
      if (!token) return;

      if (tokenMap.has(token)) {
        // This is a duplicate!
        duplicates.push(doc.id);
        console.log(`❌ Found duplicate for token ${token.substring(0, 15)}... -> Doc ID: ${doc.id}`);
      } else {
        tokenMap.set(token, doc.id);
      }
    });

    console.log(`📊 Total tokens: ${snapshot.size}`);
    console.log(`🗑️ Duplicates found: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('Deleting duplicates...');
      const batch = db.batch();
      
      duplicates.forEach(docId => {
        const ref = db.collection('fcm_tokens').doc(docId);
        batch.delete(ref);
      });

      await batch.commit();
      console.log('✅ Successfully deleted all duplicates.');
    } else {
      console.log('✅ No duplicates found.');
    }
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanDuplicateTokens();
