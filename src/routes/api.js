const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController.js');
const statusController = require('../controllers/statusController');
const announcementController = require('../controllers/announcementController');

// Route to register FCM token from Flutter app
router.post('/register-token', tokenController.registerToken);

// Route to receive device status and check for errors
router.post('/device-status', statusController.updateStatus);

// Route to send custom announcements (Ramadan, Eid, etc.)
router.post('/announcement', announcementController.sendAnnouncement);

module.exports = router;
