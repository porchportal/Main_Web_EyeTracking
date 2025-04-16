// pages/api/check-backend-connection.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
    
    console.log(`Checking backend connection at: ${backendUrl}/health`);
    
    // Attempt to connect to the backend health check endpoint
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Health check doesn't need API key
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Backend health check response:', data);
      
      // After successful health check, verify auth
      try {
        console.log(`Testing auth at: ${backendUrl}/test-auth`);
        const authResponse = await fetch(`${backendUrl}/test-auth`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          timeout: 5000 // 5 second timeout
        });
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          console.log('Auth check successful:', authData);
          
          return res.status(200).json({
            connected: true,
            authValid: true,
            message: 'Backend connection and authentication successful'
          });
        } else {
          console.error('Auth check failed:', authResponse.status, authResponse.statusText);
          
          // Backend is connected but auth failed
          return res.status(200).json({
            connected: true,
            authValid: false,
            message: 'Backend connection successful, but authentication failed'
          });
        }
      } catch (authError) {
        console.error('Auth check error:', authError);
        
        // Backend is connected but auth check had an error
        return res.status(200).json({
          connected: true,
          authValid: false,
          message: 'Backend connection successful, but authentication check failed'
        });
      }
    } else {
      console.error('Backend health check failed:', response.status, response.statusText);
      
      return res.status(200).json({
        connected: false,
        message: `Backend health check failed with status: ${response.status}`
      });
    }
  } catch (error) {
    console.error('Error connecting to backend:', error);
    
    return res.status(200).json({
      connected: false,
      message: `Error connecting to backend: ${error.message}`
    });
  }
}