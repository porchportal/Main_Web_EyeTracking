// frontend/pages/api/user-preferences/[userId].js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8010';
  const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (req.method === 'GET') {
      // Handle GET request - fetch user preferences
      const response = await fetch(`${backendUrl}/api/user-preferences/${userId}`, {
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

    } else if (req.method === 'POST') {
      // Handle POST request - update user preferences
      const { ...preferences } = req.body;
      
      // Prepare data for backend API
      const updateData = {
        preferences: preferences.preferences || {},
        theme: preferences.theme,
        language: preferences.language,
        notification_settings: preferences.notificationSettings,
        image_processing_settings: preferences.imageProcessingSettings
      };
      
      // If consent status is included, add it
      if (preferences.consentStatus !== undefined) {
        updateData.consent_status = preferences.consentStatus;
      }
      
      // Update user preferences in backend
      const response = await fetch(`${backendUrl}/api/user-preferences/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(updateData)
      });
      
      // Parse response
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: data.message || 'Failed to update user preferences',
          error: data.detail || data.error || 'Unknown error'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'User preferences updated successfully',
        data: data.data
      });

    } else {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
  } catch (error) {
    console.error('Error handling user preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to handle user preferences',
      error: error.message
    });
  }
} 