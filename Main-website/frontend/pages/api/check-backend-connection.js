// pages/api/check-backend-connection.js
import fetch from 'node-fetch';
import os from 'os';
import subprocess from 'child_process';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
const TIMEOUT_MS = 10000; // Increased timeout to 10 seconds

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms. Please check if the backend server is running at ${BACKEND_URL}`);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // First try the health check endpoint
    const healthResponse = await fetchWithTimeout(`${BACKEND_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed with status ${healthResponse.status}`);
    }

    // Then try the data center endpoint
    const dataCenterResponse = await fetchWithTimeout(`${BACKEND_URL}/api/data-center/values`);
    if (!dataCenterResponse.ok) {
      throw new Error(`Data center check failed with status ${dataCenterResponse.status}`);
    }

    const data = await dataCenterResponse.json();
    
    return res.status(200).json({
      connected: true,
      authValid: true,
      status: 'ok',
      backendUrl: BACKEND_URL,
      dataCenter: data
    });
  } catch (error) {
    console.error('Backend connection error:', error);
    return res.status(500).json({
      connected: false,
      authValid: false,
      error: error.message,
      backendUrl: BACKEND_URL,
      timestamp: new Date().toISOString()
    });
  }
}