const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const rtdbListener = require('./services/rtdbListener');
const holidayScheduler = require('./services/holidayScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', apiRoutes);

// Initialize RTDB Listener
rtdbListener.initListener();

// Initialize Holiday Scheduler
holidayScheduler.initScheduler();

// Generate a random UUID for this server process
const crypto = require('crypto');
const SERVER_UUID = crypto.randomUUID().substring(0, 8);
console.log(`🆔 SERVER PROCESS STARTED: [${SERVER_UUID}]`);
console.log(`⚠️  IF YOU SEE MULTIPLE UUIDs IN LOGS, YOU HAVE MULTIPLE SERVERS RUNNING!`);

// Health check
app.get('/', (req, res) => {
  res.send('STA-1300 Backend is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
