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
  const backendUrl = process.env.AUTH_SERVICE_URL;
  const apiKey = process.env.API_KEY;

  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Get user data using new consent endpoint
    const response = await fetch(`${backendUrl}/consent/check-user/${userId}`, {
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
        message: data.message || 'Failed to fetch user data',
        error: data.detail || data.error || 'Unknown error'
      });
    }
    
    // Transform the response to match expected format
    if (data.success && data.data) {
      const userData = data.data.user_data;
      if (userData && userData.profile) {
        return res.status(200).json({
          success: true,
          data: {
            username: userData.profile.username || "",
            sex: userData.profile.sex || "",
            age: userData.profile.age || "",
            night_mode: userData.profile.night_mode || false,
            email: "test@example.com", // Default email
            settings: userData.settings || {}
          }
        });
      } else {
        // User not initialized, return empty data
        return res.status(200).json({
          success: true,
          data: {
            username: "",
            sex: "",
            age: "",
            night_mode: false,
            email: "test@example.com",
            settings: {}
          }
        });
      }
    }
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      error: error.message
    });
  }
}