import { serialize, parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse cookies from the request
    const cookies = parse(req.headers.cookie || '');
    const adminSession = cookies.admin_session;

    if (!adminSession) {
      return res.status(401).json({ message: 'No session found' });
    }

    // Verify session with backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8010';
    const response = await fetch(`${backendUrl}/api/admin/verify-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: adminSession }),
    });

    if (!response.ok) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    return res.status(200).json({ message: 'Authenticated' });
  } catch (error) {
    console.error('Error checking authentication:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 