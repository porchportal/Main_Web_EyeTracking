import { serialize, parse } from 'cookie';

// Combined authentication utility function
async function verifyAdminToken(req) {
  try {
    // Parse cookies from the request
    const cookies = parse(req.headers.cookie || '');
    const adminSession = cookies.admin_session;

    if (!adminSession) {
      return { authenticated: false, message: 'No session found' };
    }

    // Verify session with backend - use direct backend service URL
    const backendUrl = process.env.AUTH_SERVICE_URL;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${backendUrl}/api/admin/verify-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: adminSession }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { authenticated: false, message: 'Invalid session' };
    }

    return { authenticated: true, message: 'Authenticated' };
  } catch (error) {
    console.error('Error verifying admin token:', error);
    if (error.name === 'AbortError') {
      return { authenticated: false, message: 'Request timeout' };
    }
    return { authenticated: false, message: 'Internal server error' };
  }
}

export default async function handler(req, res) {
  const { method } = req;

  // Handle login (POST request)
  if (method === 'POST') {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
      // Use direct backend service URL for server-side calls
      const backendUrl = process.env.AUTH_SERVICE_URL;
      
      if (!backendUrl) {
        console.error('AUTH_SERVICE_URL environment variable is not set');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      console.log(`Attempting to authenticate with backend: ${backendUrl}/api/admin/auth`);
      
      const response = await fetch(`${backendUrl}/api/admin/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log(`Backend response status: ${response.status}`);

      if (response.ok) {
        try {
          const data = await response.json();
          
          // Validate that we received a session token
          if (!data.session) {
            console.error('Backend response missing session token:', data);
            return res.status(500).json({ message: 'Invalid response from authentication service' });
          }
          
          // Get the session token from backend response
          const sessionToken = data.session;
          
          // Set the httpOnly cookie with the same settings as the backend
          res.setHeader('Set-Cookie', `admin_session=${sessionToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600`);
          
          console.log('Authentication successful, session cookie set');
          return res.status(200).json({ message: 'Authentication successful' });
        } catch (parseError) {
          console.error('Error parsing backend response:', parseError);
          return res.status(500).json({ message: 'Invalid response from authentication service' });
        }
      } else {
        try {
          const errorData = await response.json();
          console.log('Backend authentication failed:', errorData);
          return res.status(401).json({ message: errorData.detail || 'Invalid credentials' });
        } catch (parseError) {
          console.error('Error parsing backend error response:', parseError);
          return res.status(401).json({ message: `Authentication failed (${response.status})` });
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error.name === 'AbortError') {
        return res.status(408).json({ message: 'Request timeout - authentication service unavailable' });
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ message: 'Authentication service unavailable' });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Handle session verification (GET request)
  if (method === 'GET') {
    try {
      // Parse cookies from the request
      const cookies = parse(req.headers.cookie || '');
      const adminSession = cookies.admin_session;

      if (!adminSession) {
        // Check if we should suppress error logging
        if (req.headers['x-suppress-errors']) {
          // Return a custom response that won't trigger console errors
          return res.status(200).json({ 
            message: 'Fallback',
            authenticated: false,
            suppressErrors: true
          });
        }
        return res.status(401).json({ message: 'No session found' });
      }

      // Verify session with backend - use direct backend service URL
      const backendUrl = process.env.AUTH_SERVICE_URL;
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${backendUrl}/api/admin/verify-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session: adminSession }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check if we should suppress error logging
        if (req.headers['x-suppress-errors']) {
          // Return a custom response that won't trigger console errors
          return res.status(200).json({ 
            message: 'Fallback',
            authenticated: false,
            suppressErrors: true
          });
        }
        return res.status(401).json({ message: 'Invalid session' });
      }

      return res.status(200).json({ message: 'Authenticated' });
    } catch (error) {
      console.error('Error checking authentication:', error);
      if (error.name === 'AbortError') {
        return res.status(408).json({ message: 'Request timeout' });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Handle logout (DELETE request)
  if (method === 'DELETE') {
    try {
      // Clear the admin session cookie
      res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
      
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error during logout:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Handle unsupported methods
  return res.status(405).json({ message: 'Method not allowed' });
}

// Export the verifyAdminToken function for use by other API routes
export { verifyAdminToken }; 