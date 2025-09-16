// pages/api/user-captures/save/[userId].js
import fs from 'fs';
import path from 'path';

// Use direct backend URL instead of nginx proxy to avoid circular routing
const BACKEND_URL = process.env.AUTH_SERVICE_URL;

// Environment variables configuration

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

    // Use direct backend URL to avoid nginx circular routing
    const backendUrl = `${BACKEND_URL}/api/user-captures/save/${userId}`;

    const requestBody = {
      imageData,
      filename,
      type,
      captureGroup
    };

    // Forward the request directly to the backend
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': req.headers['x-api-key'] || req.headers['X-API-Key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify(requestBody)
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}