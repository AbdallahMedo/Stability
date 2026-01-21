const { db, messaging } = require('../config/firebase');

/**
 * Send a custom announcement notification to all devices or a specific target token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendAnnouncement = async (req, res) => {
  try {
    const { title, body, targetToken } = req.body; // Remove 'data' from destructuring since we construct it manually

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    let tokens = [];

    if (targetToken) {
      // If a specific token is provided, use only that (for testing)
      console.log(`🎯 Targeting specific token: ${targetToken.substring(0, 20)}...`);
      tokens.push(targetToken);
    } else {
      // Get all registered tokens from Firestore
      const tokensSnapshot = await db.collection('fcm_tokens').get();
      
      if (tokensSnapshot.empty) {
        return res.status(404).json({ message: 'No devices registered to receive announcements' });
      }

      tokensSnapshot.forEach(doc => {
        const tokenData = doc.data();
        if (tokenData.token && tokenData.token.length > 20) {
          tokens.push(tokenData.token);
        }
      });
    }

    if (tokens.length === 0) {
      return res.status(404).json({ message: 'No valid tokens found' });
    }

    console.log(`📢 Sending announcement "${title}" to ${tokens.length} devices...`);

    // Construct the message payload
    // We strictly control the data payload to ensure mobile app compatibility
    const messages = tokens.map(token => ({
      token: token,
      notification: {
        title: title,
        body: body
      },
      // Simplified Data Payload
      // This ensures the mobile app treats it as a standard notification
      // and doesn't need special "greeting" logic if not implemented.
      data: {
        type: 'announcement', 
        timestamp: new Date().toISOString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK' // Standard Flutter action
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel_new', 
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            sound: 'default',
            badge: 1,
            'content-available': 1
          }
        }
      }
    }));

    // Send messages
    const response = await messaging.sendEach(messages);
    
    console.log(`✅ Announcement sent: ${response.successCount} success, ${response.failureCount} failure`);

    // Log errors if any
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ Failure for token ${idx}:`, resp.error);
        }
      });
    }

    return res.status(200).json({
      message: 'Announcement processing complete',
      stats: {
        success: response.successCount,
        failure: response.failureCount
      }
    });

  } catch (error) {
    console.error('❌ Error sending announcement:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
