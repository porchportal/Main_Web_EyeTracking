// pages/api/check-backend-connection.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
    
    // Try to connect to the backend's health check endpoint
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Check if we got a successful response
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        success: true,
        connected: data.status === 'ok',
        message: 'Successfully connected to backend'
      });
    } else {
      return res.status(200).json({
        success: true,
        connected: false,
        message: `Backend responded with status ${response.status}`
      });
    }
  } catch (error) {
    console.error('Error checking backend connection:', error);
    return res.status(200).json({
      success: true,
      connected: false,
      message: `Could not connect to backend: ${error.message}`
    });
  }
}