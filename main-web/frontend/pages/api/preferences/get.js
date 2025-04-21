// frontend/pages/api/preferences/get.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Get all user preferences from backend
    const response = await fetch(`${backendUrl}/user-preferences/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
    
    // Parse response
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Failed to fetch user preferences',
        error: data.detail || data.error || 'Unknown error'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: data.data
    });
    
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      error: error.message
    });
  }
}