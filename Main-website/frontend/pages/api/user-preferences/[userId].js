// frontend/pages/api/user-preferences/[userId].js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  // Validate required environment variables
  if (!backendUrl) {
    console.error('BACKEND_URL environment variable is not set');
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error: BACKEND_URL not configured' 
    });
  }

  if (!apiKey) {
    console.error('NEXT_PUBLIC_API_KEY environment variable is not set');
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error: API key not configured' 
    });
  }

  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (req.method === 'GET') {
      // Handle GET request - fetch user data using new consent endpoint
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

    } else if (req.method === 'POST' || req.method === 'PUT') {
      // Handle POST/PUT request - update user profile using new consent endpoint
      const { username, sex, age, night_mode, cookie, ...otherPreferences } = req.body;
      
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
        data: data
      });
    } else {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Error in user preferences handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
} 