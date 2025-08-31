// frontend/pages/api/preferences/consent.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.BACKEND_URL;
  // const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
  const apiKey = process.env.API_KEY ;

  try {
    if (req.method === 'GET') {
      // Get user consent status from backend
      const userId = req.query.userId;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      const response = await fetch(`${backendUrl}/consent/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });
      
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
      
    } else if (req.method === 'POST') {
      // Update user consent status
      const { userId, consentStatus } = req.body;
      
      if (!userId || consentStatus === undefined) {
        return res.status(400).json({
          success: false,
          message: 'User ID and consent status are required'
        });
      }
      
      const timestamp = new Date().toISOString();
      
      const response = await fetch(`${backendUrl}/consent/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          consent_status: consentStatus,
          timestamp: timestamp
        })
      });
      
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
      
    } else {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Error communicating with backend:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with backend',
      error: error.message
    });
  }
}