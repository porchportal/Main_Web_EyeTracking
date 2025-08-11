// frontend/pages/api/preferences/update.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8010';
  const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

  try {
    const { userId, username, sex, age, night_mode, ...otherPreferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Prepare profile data for the new endpoint
    const profileData = {
      username: username || "",
      sex: sex || "",
      age: age || "",
      night_mode: night_mode || false
    };
    
    // Update user profile using the new consent endpoint
    const response = await fetch(`${backendUrl}/consent/update-user-profile/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(profileData)
    });
    
    // Parse response
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Failed to update user profile',
        error: data.detail || data.error || 'Unknown error'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully',
      data: data.data
    });
    
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user preferences',
      error: error.message
    });
  }
}