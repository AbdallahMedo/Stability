const { rtdb } = require('../config/firebase');
const deviceService = require('./deviceService');

// The path to listen to in the Realtime Database.
// Listen specifically to the EVT node as requested.
const LISTENER_PATH = 'Stability/Errors/EVT'; 

// Cache to store the last processed value to prevent duplicate notifications
let lastEvtValue = null;
let lastProcessedTime = 0;
// Increased debounce time to 10 seconds to strictly filter out rapid duplicates
const DEBOUNCE_TIME_MS = 10000; 

/**
 * Initialize the Realtime Database listener.
 * This function should be called when the server starts.
 */
exports.initListener = () => {
  console.log(`Starting RTDB Listener on path: ${LISTENER_PATH}...`);

  const ref = rtdb.ref(LISTENER_PATH);

  // Listen for changes on the EVT node directly
  ref.on('value', async (snapshot) => {
    try {
      const evtValue = snapshot.val();
      const now = Date.now();
      
      // If value is null, ignore
      if (evtValue === null) {
        return;
      }

      // 🔍 DUPLICATE CHECK 1: Value Equality
      // Only process if the value has actually changed
      if (evtValue === lastEvtValue) {
        // Value hasn't changed, so it's a redundant update (RTDB sometimes fires these)
        // console.log('Duplicate value detected, ignoring.');
        return;
      }

      // 🔍 DUPLICATE CHECK 2: Time-based Debounce
      // Even if value changed, prevent rapid-fire updates within 10 seconds
      if (now - lastProcessedTime < DEBOUNCE_TIME_MS) {
        console.log(`⚠️ Rapid update detected (${now - lastProcessedTime}ms), ignoring to prevent spam.`);
        return;
      }

      console.log(`Received update on ${LISTENER_PATH}: ${evtValue} (Changed from ${lastEvtValue})`);
      
      // Update the cache
      lastEvtValue = evtValue;
      lastProcessedTime = now;

      // Construct the payload structure expected by processDeviceStatus
      const payload = {
        Stability: {
          Errors: {
            EVT: evtValue
          }
        },
        timestamp: new Date().toISOString(),
        source: 'RTDB_LISTENER'
      };

      await deviceService.processDeviceStatus(payload);

    } catch (error) {
      console.error('Error processing RTDB update:', error);
    }
  });
  
  console.log('RTDB Listener attached.');
};
