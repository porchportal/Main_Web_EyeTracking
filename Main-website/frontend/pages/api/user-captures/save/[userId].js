// pages/api/user-captures/save/[userId].js
import fs from 'fs';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8108';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    const { imageData, filename, type, captureGroup } = req.body;

    if (!imageData || !filename || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: imageData, filename, or type'
      });
    }

    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': req.headers['x-api-key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify({
        imageData,
        filename,
        type,
        captureGroup
      })
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('Backend error:', errorData);
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    console.log(`✅ Forwarded save request to backend for user ${userId}:`, result);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error in user-captures save API:', error);
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}
