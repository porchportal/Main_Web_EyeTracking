// pages/api/user-captures/save/[userId].js
import fs from 'fs';
import path from 'path';

// Use direct backend URL instead of nginx proxy to avoid circular routing
const BACKEND_URL = process.env.AUTH_SERVICE_URL;

// Debug environment variables
console.log('🔧 Environment variables in save API:', {
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
  fallbackUsed: !process.env.AUTH_SERVICE_URL
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    const { imageData, filename, type, captureGroup } = req.body;

    console.log('🔍 Frontend API received request:', {
      userId,
      hasImageData: !!imageData,
      imageDataLength: imageData?.length || 0,
      filename,
      type,
      captureGroup,
      method: req.method,
      headers: Object.keys(req.headers),
      backendUrl: BACKEND_URL
    });

    if (!imageData || !filename || !type) {
      console.error('❌ Missing required fields:', { imageData: !!imageData, filename: !!filename, type: !!type });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: imageData, filename, or type'
      });
    }

    // Use direct backend URL to avoid nginx circular routing
    const backendUrl = `${BACKEND_URL}/api/user-captures/save/${userId}`;
    console.log('📤 Forwarding to backend directly:', backendUrl);

    const requestBody = {
      imageData,
      filename,
      type,
      captureGroup
    };

    console.log('📤 Backend request body keys:', Object.keys(requestBody));

    // Forward the request directly to the backend
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': req.headers['x-api-key'] || req.headers['X-API-Key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Backend response status: ${backendResponse.status} ${backendResponse.statusText}`);

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('❌ Backend error response:', errorData);
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    console.log(`✅ Successfully forwarded save request to backend for user ${userId}:`, result);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error in user-captures save API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}