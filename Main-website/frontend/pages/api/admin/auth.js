import { serialize, parse } from 'cookie';

export default async function handler(req, res) {
  const { method } = req;

  // Handle login (POST request)
  if (method === 'POST') {
    const { username, password } = req.body;

    try {
      // Use the nginx proxy URL since that's what the frontend is configured to use
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80';
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${backendUrl}/api/admin/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        // Get the session token from backend response
        const sessionToken = data.session;
        
        // Set the httpOnly cookie with the same settings as the backend
        res.setHeader('Set-Cookie', `admin_session=${sessionToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600`);
        
        return res.status(200).json({ message: 'Authentication successful' });
      } else {
        return res.status(401).json({ message: data.detail || 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error.name === 'AbortError') {
        return res.status(408).json({ message: 'Request timeout' });
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
        return res.status(401).json({ message: 'No session found' });
      }

      // Verify session with backend through nginx proxy
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80';
      
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