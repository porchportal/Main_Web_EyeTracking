// pages/api/check-backend-connection.js
import fetch from 'node-fetch';
import https from 'https';
import os from 'os';
import subprocess from 'child_process';

// Use internal API URL for server-side calls (HTTPS for nginx proxy)
const BACKEND_URL = process.env.INTERNAL_API_URL || process.env.BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || process.env.BACKEND_API_KEY;
const TIMEOUT_MS = 5000; // Reduced timeout to 5 seconds for better responsiveness


// Create a custom agent that ignores SSL certificate errors for internal Docker communication
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // Only for internal Docker communication
});

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow', // Follow redirects
      agent: url.startsWith('https') ? httpsAgent : undefined, // Use custom agent for HTTPS
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers
      }
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms. Please check if the backend server is running at ${BACKEND_URL}`);
    }
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused to ${BACKEND_URL}. Please check if the backend service is running.`);
    }
    if (error.code === 'ENOTFOUND') {
      throw new Error(`Host not found: ${BACKEND_URL}. Please check the service configuration.`);
    }
    if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      throw new Error(`SSL certificate error: ${error.message}. This is likely due to self-signed certificates in the Docker environment.`);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate required environment variables
  if (!BACKEND_URL) {
    console.error('INTERNAL_API_URL environment variable is not set');
    return res.status(500).json({
      connected: false,
      authValid: false,
      error: 'Server configuration error: INTERNAL_API_URL not configured',
      backendUrl: null,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // First try the health check endpoint with retry logic
    let healthResponse;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        healthResponse = await fetchWithTimeout(`${BACKEND_URL}/health`);
        if (healthResponse.ok) {
          break; // Success, exit retry loop
        }
        
        // If not 503, don't retry
        if (healthResponse.status !== 503) {
          throw new Error(`Health check failed with status ${healthResponse.status}`);
        }
        
        retryCount++;
        if (retryCount <= maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      } catch (err) {
        if (retryCount >= maxRetries) {
          throw err;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (!healthResponse || !healthResponse.ok) {
      throw new Error(`Health check failed after ${maxRetries + 1} attempts`);
    }

    // Parse health data
    const healthData = await healthResponse.json();
    
    const response = {
      connected: true,
      authValid: true, // Set to true if health check passes
      status: 'ok',
      backendUrl: BACKEND_URL,
      serverInfo: healthData,
      retryCount: retryCount
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Backend connection error:', error);
    
    // Return 503 for service unavailable, 500 for other errors
    const statusCode = error.message.includes('503') || error.message.includes('unavailable') ? 503 : 500;
    
    return res.status(statusCode).json({
      connected: false,
      authValid: false,
      error: error.message,
      backendUrl: BACKEND_URL,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
  }
}