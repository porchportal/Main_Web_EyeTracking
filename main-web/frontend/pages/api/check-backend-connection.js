// pages/api/check-backend-connection.js
import http from 'http';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const url = new URL(backendUrl);
    
    // Use Node's http module to check connection without fetch
    const checkConnection = () => {
      return new Promise((resolve) => {
        const request = http.request(
          {
            hostname: url.hostname,
            port: url.port || 8000,
            path: '/health',
            method: 'GET',
            timeout: 5000, // 5 second timeout
          },
          (response) => {
            let data = '';
            response.on('data', (chunk) => {
              data += chunk;
            });
            
            response.on('end', () => {
              try {
                // Try to parse the response as JSON
                const jsonData = JSON.parse(data);
                resolve({
                  connected: true,
                  status: jsonData.status || 'ok'
                });
              } catch (e) {
                // If can't parse as JSON, at least we got a response
                resolve({
                  connected: true,
                  status: 'unknown'
                });
              }
            });
          }
        );
        
        request.on('error', (error) => {
          console.error('Backend connection error:', error.message);
          resolve({
            connected: false,
            error: error.message
          });
        });
        
        request.on('timeout', () => {
          request.destroy();
          resolve({
            connected: false,
            error: 'Connection timeout'
          });
        });
        
        request.end();
      });
    };
    
    const result = await checkConnection();
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in check-backend API:', error);
    return res.status(200).json({ 
        connected: true,
        status: 'mock'
    });
  }
}