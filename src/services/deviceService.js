const { db, messaging } = require('../config/firebase');

const ERROR_CODES = {
  100: 'Temperature Sensor Disconnected',
  200: 'Humidity Sensor Error',
  201: 'Humidity Sensor Over Range',
  300: 'Steamer Sensor Error',
  400: 'Chamber Overheat Warning',
  401: 'Steamer Overheat Warning',
  500: 'Over Humidity Warning',
  600: 'SD Card Init Failed',
  601: 'SD Card Open Failed',
  602: 'SD Card Write Failed',
  700: 'USB Not Ready',
  701: 'USB Transfer Failed'
};

/**
 * Process device status data
 * @param {Object} data - The device status data
 * @returns {Promise<Object>} - Result of the operation
 */
exports.processDeviceStatus = async (data) => {
  if (!data || !data.Stability) {
    throw new Error('Invalid data format');
  }

  const errors = data.Stability.Errors;
  
  if (errors && errors.EVT) {
    const errorCode = errors.EVT;
    
    if (errorCode > 0) {
      const errorMsg = ERROR_CODES[errorCode] || 'Unknown Error';
      console.log(`Detected Error ${errorCode}: ${errorMsg}`);
      
      // 🔥 SERVER-SIDE DEDUPLICATION WITH FIRESTORE 🔥
      // Check if we already sent a notification for this error recently
      const shouldSend = await checkRateLimit(errorCode);
      
      if (shouldSend) {
        await sendErrorNotification(errorCode, errorMsg);
      } else {
        console.log(`⚠️ Rate limit: Notification for Error ${errorCode} was sent recently. Skipping.`);
      }
    }
  }

  await db.collection('device_status').add({
    ...data,
    receivedAt: new Date()
  });

  return { message: 'Status processed' };
};

/**
 * Check if a notification for this error code should be sent.
 * Uses Firestore to maintain a distributed lock/rate limit.
 * @param {number|string} errorCode 
 * @returns {Promise<boolean>}
 */
async function checkRateLimit(errorCode) {
  const lockRef = db.collection('system_locks').doc('notification_lock');
  const now = Date.now();
  const COOLDOWN_MS = 10000; // 10 seconds cooldown between same errors

  try {
    return await db.runTransaction(async (t) => {
      const doc = await t.get(lockRef);
      
      if (!doc.exists) {
        // First time ever, allow and create doc
        t.set(lockRef, {
          lastErrorCode: errorCode,
          lastSentAt: now
        });
        return true;
      }

      const data = doc.data();
      const lastCode = data.lastErrorCode;
      const lastTime = data.lastSentAt || 0;

      if (String(lastCode) === String(errorCode) && (now - lastTime < COOLDOWN_MS)) {
        // Same error sent less than 10 seconds ago -> BLOCK
        return false;
      }

      // Different error OR enough time passed -> ALLOW and UPDATE
      t.update(lockRef, {
        lastErrorCode: errorCode,
        lastSentAt: now
      });
      return true;
    });
  } catch (error) {
    console.error('❌ Error checking rate limit:', error);
    // If DB fails, default to allowing notification to be safe
    return true;
  }
}

async function sendErrorNotification(code, message) { 
  try {
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    
    if (tokensSnapshot.empty) { 
      console.log('No tokens registered for notification.'); 
      return; 
    } 

    const tokens = [];
    const seenTokenStrings = new Set(); // 🔥 Set for string deduplication
    const invalidTokens = [];
    
    tokensSnapshot.forEach(doc => { 
      const tokenData = doc.data();
      const token = tokenData.token;
      
      if (token && token.length > 100 && token.includes(':')) {
        // 🔥 TOKEN DEDUPLICATION CHECK
        if (seenTokenStrings.has(token)) {
          console.log(`♻️ Skipping duplicate token string found in doc ${doc.id}`);
          // Optionally delete the duplicate here, but let's just skip for safety first
          // invalidTokens.push(doc.id); // Uncomment to aggressive clean
        } else {
          seenTokenStrings.add(token);
          tokens.push({
            token: token,
            docId: doc.id
          });
        }
      } else {
        console.log(`⚠️ Invalid token format, length: ${token?.length}`);
        invalidTokens.push(doc.id);
      }
    });

    if (invalidTokens.length > 0) {
      console.log(`🗑️ Removing ${invalidTokens.length} invalid tokens...`);
      const deletePromises = invalidTokens.map(docId => 
        db.collection('fcm_tokens').doc(docId).delete()
      );
      await Promise.all(deletePromises);
    }

    if (tokens.length === 0) {
      console.log('No valid tokens found.');
      return;
    }

    // 🔥 الحل الجذري: إرسال notification و data معاً
    const messages = tokens.map(({token}) => ({
      token: token,
      // 🔥 هذا الجزء CRITICAL - لازم يكون موجود عشان الإشعار يظهر في terminated state
      notification: {
        title: '🔔 Stability Error Alert',
        body: `Error ${code}: ${message}`
      },
      // 🔥 Data payload للمعالجة الإضافية
      data: {
        errorCode: String(code),
        errorMessage: message,
        type: 'error',
        priority: 'high',
        timestamp: new Date().toISOString()
      },
      // 🔥 Android specific settings
      android: {
        priority: 'high',
        ttl: 3600 * 1000, // milliseconds
        notification: {
          channelId: 'high_importance_channel_new',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          defaultLightSettings: true,
          // 🔥 هذا مهم جداً للـ terminated state
          notificationCount: 1
        }
      },
      // 🔥 iOS specific settings
      apns: {
        payload: {
          aps: {
            alert: {
              title: '🔔 Stability Error Alert',
              body: `Error ${code}: ${message}`
            },
            sound: 'default',
            badge: 1,
            // 🔥 مهم جداً للـ background/terminated
            'content-available': 1,
            // 🔥 للتنبيهات العاجلة
            'interruption-level': 'time-sensitive'
          }
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert'
        }
      }
    }));

    if (messages.length > 0) {
      try {
        console.log(`🚀 Sending ${messages.length} messages...`);
        // Log sample message payload for debugging
        console.log('📝 Sample Payload:', JSON.stringify(messages[0], null, 2));

        const response = await messaging.sendEach(messages);
        
        // Detailed logging of response
        console.log('🔍 FCM Response:', JSON.stringify(response, null, 2));
        console.log(`📤 Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);
        
        const cleanupPromises = [];
        
        response.responses.forEach((resp, idx) => {
          const tokenInfo = tokens[idx];
          
          if (!resp.success) {
            console.error(`❌ Failed to send to token ${idx}:`, resp.error);
            
            if (resp.error && 
                (resp.error.code === 'messaging/registration-token-not-registered' ||
                 resp.error.code === 'messaging/invalid-registration-token' ||
                 resp.error.code === 'messaging/invalid-argument')) {
              
              console.log(`🗑️ Removing invalid token: ${tokenInfo.token.substring(0, 20)}...`);
              
              cleanupPromises.push(
                db.collection('fcm_tokens').doc(tokenInfo.docId).delete()
              );
            }
          } else {
            cleanupPromises.push(
              db.collection('fcm_tokens').doc(tokenInfo.docId).update({
                lastUsed: new Date(),
                active: true
              })
            );
          }
        });
        
        if (cleanupPromises.length > 0) {
          await Promise.allSettled(cleanupPromises);
          console.log(`✅ Cleaned up ${cleanupPromises.length} tokens`);
        }
        
      } catch (error) {
        console.error('❌ Error sending notifications:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error in sendErrorNotification:', error);
  }
}
