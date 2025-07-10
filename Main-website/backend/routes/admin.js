const express = require('express');
const router = express.Router();
require('dotenv').config({ path: '.env.backend' });

// Admin authentication route
router.post('/auth', (req, res) => {
  const { username, password } = req.body;

  console.log('Received credentials:', { username, password });
  console.log('Expected credentials:', { 
    adminUsername: process.env.ADMIN_USERNAME, 
    adminPassword: process.env.ADMIN_PASSWORD 
  });

  // Check credentials against environment variables
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ message: 'Authentication successful' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});

module.exports = router; 