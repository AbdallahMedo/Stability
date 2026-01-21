const cron = require('node-cron');
const moment = require('moment-hijri');
const announcementController = require('../controllers/announcementController');

// Define holiday messages
const HOLIDAYS = {
  RAMADAN: {
    month: 9, // Ramadan
    day: 1,
    title: 'رمضان كريم 🌙',
    body: 'كيم تك تهنئكم بحلول شهر رمضان المبارك، أعاده الله عليكم بالخير واليمن والبركات.'
  },
  EID_FITR: {
    month: 10, // Shawwal
    day: 1,
    title: 'عيد فطر سعيد 🎉',
    body: 'كيم تك تهنئكم بحلول عيد الفطر المبارك، تقبل الله طاعتكم وعساكم من عواده.'
  },
  EID_ADHA: {
    month: 12, // Dhu al-Hijjah
    day: 10,
    title: 'عيد أضحى مبارك 🐑',
    body: 'كيم تك تهنئكم بحلول عيد الأضحى المبارك، كل عام وأنتم بخير.'
  }
};

/**
 * Check if today is a holiday and send notification
 */
const checkAndSendHolidayNotification = async () => {
  // Get current Hijri date
  const today = moment();
  const hMonth = today.iMonth() + 1; // iMonth is 0-indexed (0-11)
  const hDay = today.iDate();

  console.log(`📅 Daily Holiday Check: Today is Hijri ${hDay}/${hMonth}/${today.iYear()}`);

  let holiday = null;

  if (hMonth === HOLIDAYS.RAMADAN.month && hDay === HOLIDAYS.RAMADAN.day) {
    holiday = HOLIDAYS.RAMADAN;
  } else if (hMonth === HOLIDAYS.EID_FITR.month && hDay === HOLIDAYS.EID_FITR.day) {
    holiday = HOLIDAYS.EID_FITR;
  } else if (hMonth === HOLIDAYS.EID_ADHA.month && hDay === HOLIDAYS.EID_ADHA.day) {
    holiday = HOLIDAYS.EID_ADHA;
  }

  if (holiday) {
    console.log(`🎉 Holiday Detected: ${holiday.title}`);
    
    // Create a mock request/response object to reuse the controller logic
    // or better, extract the logic. Here we will construct the request object 
    // and call the function directly, but we need to mock the res object.
    
    // Since calling controller requires res.status().json(), it's better to reuse the messaging logic directly
    // OR create a helper function. For simplicity and reliability, let's just make an internal call
    // mimicking the payload structure and calling the controller, handling the response manually.
    
    const req = {
      body: {
        title: holiday.title,
        body: holiday.body
      }
    };

    const res = {
      status: (code) => ({
        json: (data) => console.log(`Holiday Notification Result [${code}]:`, data)
      })
    };

    try {
      await announcementController.sendAnnouncement(req, res);
    } catch (error) {
      console.error('Error sending holiday notification:', error);
    }
  } else {
    console.log('No holidays today.');
  }
};

/**
 * Initialize the scheduler
 */
exports.initScheduler = () => {
  console.log('⏳ Holiday Scheduler initialized.');
  
  // Schedule to run every day at 12:00 PM (Noon)
  // Cron format: Minute Hour Day Month DayOfWeek
  cron.schedule('0 12 * * *', () => {
    checkAndSendHolidayNotification();
  });

  // Run a check immediately on startup (for demonstration/verification purposes)
  // In production, you might want to remove this or make it conditional.
  // We'll leave it for now so you can see it working if today happened to be a holiday.
  checkAndSendHolidayNotification();
};
