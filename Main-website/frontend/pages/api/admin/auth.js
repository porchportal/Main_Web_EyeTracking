export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  try {
    // Use the nginx proxy URL since that's what the frontend is configured to use
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8108';
    const response = await fetch(`${backendUrl}/api/admin/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

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
    return res.status(500).json({ message: 'Internal server error' });
  }
} 