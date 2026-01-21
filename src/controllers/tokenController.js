const { db } = require('../config/firebase');

/**
 * Registers a new FCM token from the Flutter app.
 * Expects body: { "token": "..." }
 */
exports.registerToken = async (req, res) => {
  try {
    const { token, deviceId, platform, appVersion } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // 🔥 تحسين التحقق من التوكن
    if (!token.includes('APA91b') && !token.includes('APA91b')) {
      console.warn(`⚠️ Suspicious token format: ${token.substring(0, 50)}...`);
      // نستمر رغم ذلك، لأن بعض التوكنات قد تكون بصيغة مختلفة
    }

    // 🔥 استخدم deviceId إذا متاح، وإلا استخدم التوكن
    const docId = deviceId || token;
    
    // 🔥 البحث عن توكنات قديمة لنفس الجهاز
    if (deviceId) {
      const existingTokens = await db.collection('fcm_tokens')
        .where('deviceId', '==', deviceId)
        .get();

      // حذف التوكنات القديمة لنفس الجهاز
      const deletePromises = [];
      existingTokens.forEach(doc => {
        if (doc.id !== docId) { // لا تحذف الوثيقة الحالية
          deletePromises.push(doc.ref.delete());
        }
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`🗑️ Deleted ${deletePromises.length} old tokens for device ${deviceId}`);
      }
    }

    // 🔥 حفظ التوكن الجديد مع بيانات إضافية
    await db.collection('fcm_tokens').doc(docId).set({
      token: token,
      deviceId: deviceId || 'unknown',
      platform: platform || 'android',
      appVersion: appVersion || '1.0.0',
      createdAt: new Date(),
      lastUpdated: new Date(),
      active: true
    }, { merge: true }); // 🔥 استخدم merge لتحديث الحقول فقط

    console.log(`✅ Token registered: ${token.substring(0, 30)}...`);
    
    return res.status(200).json({ 
      message: 'Token registered successfully',
      registeredAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error registering token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};