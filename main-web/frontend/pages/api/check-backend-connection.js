// pages/api/check-backend-connection.js
import fetch from 'node-fetch';
import os from 'os';
import subprocess from 'child_process';

export default async function handler(req, res) {
  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
    
    console.log(`Checking backend connection at: ${backendUrl}/check-backend-connection`);
    
    // Enhanced fetch function with proper error handling and timeout
    const fetchWithTimeout = async (url, options = {}, timeoutMs = 5000) => {
      const abortController = new AbortController();
      const { signal } = abortController;
      
      const timeout = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal
        });
        return response;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    };
    
    try {
      // First try the connection check endpoint (doesn't require auth)
      // Using a shorter timeout for faster feedback
      const connectionResponse = await fetchWithTimeout(`${backendUrl}/api/check-backend-connection`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }, 3000);
      
      if (!connectionResponse.ok) {
        console.error('Connection check failed:', connectionResponse.status, connectionResponse.statusText);
        return res.status(200).json({
          connected: false,
          authValid: false,
          message: `Backend connection check failed with status: ${connectionResponse.status}`,
          error: {
            type: 'connection_check_failed',
            status: connectionResponse.status,
            statusText: connectionResponse.statusText
          }
        });
      }
      
      const connectionData = await connectionResponse.json();
      console.log('Backend connection check response:', connectionData);
      
      // Then check if auth is valid using the test-auth endpoint
      try {
        const authResponse = await fetchWithTimeout(`${backendUrl}/test-auth`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          }
        }, 3000);
        
        const authValid = authResponse.ok;
        const authStatus = authResponse.status;
        
        if (authValid) {
          let authData = {};
          try {
            authData = await authResponse.json();
            console.log('Auth check successful:', authData);
          } catch (parseError) {
            console.error('Error parsing auth response:', parseError);
          }
          
          return res.status(200).json({
            connected: true,
            authValid: true,
            message: 'Backend connection and authentication successful',
            serverInfo: {
              status: connectionData.status || 'ok'
            }
          });
        } else {
          console.error('Auth check failed:', authStatus, authResponse.statusText);
          
          return res.status(200).json({
            connected: true,
            authValid: false,
            message: 'Backend connected but authentication failed',
            error: {
              type: 'auth_failed',
              status: authStatus,
              statusText: authResponse.statusText
            }
          });
        }
      } catch (authError) {
        console.error('Auth check error:', authError);
        return res.status(200).json({
          connected: true,
          authValid: false,
          message: 'Backend connected but authentication check failed',
          error: {
            type: 'auth_check_error',
            message: authError.message
          }
        });
      }
    } catch (connectionError) {
      console.error('Connection check error:', connectionError);
      return res.status(200).json({
        connected: false,
        authValid: false,
        message: 'Backend connection check failed',
        error: {
          type: 'connection_error',
          message: connectionError.message
        }
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      connected: false,
      authValid: false,
      message: 'Unexpected error during backend connection check',
      error: {
        type: 'unexpected_error',
        message: error.message
      }
    });
  }
}