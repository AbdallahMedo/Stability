const deviceService = require('../services/deviceService');

exports.updateStatus = async (req, res) => {
  try {
    const data = req.body;
    
    await deviceService.processDeviceStatus(data);

    return res.status(200).json({ message: 'Status processed' });
  } catch (error) {
    if (error.message === 'Invalid data format') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    console.error('Error processing status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
