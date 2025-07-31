import { serialize } from 'cookie';

import { parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse cookies to get the session token
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.admin_session;

    // Call backend logout endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8010';
    const response = await fetch(`${backendUrl}/api/admin/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: sessionToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to logout from backend');
    }

    // Clear the admin session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: new Date(0), // Expire immediately
    };

    res.setHeader('Set-Cookie', `admin_session=; ${Object.entries(cookieOptions).map(([key, value]) => `${key}=${value}`).join('; ')}`);

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 